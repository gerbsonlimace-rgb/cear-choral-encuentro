"""Render the approved 1080x1920 card with real QR images, then decode every result.
The reference is the approved avatar-left card from the WhatsApp chat. This is
deterministic template/data composition, not AI generation or photo retouching.
Usage: python scripts/render-participant-cards.py [output/participant-cards]
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps
import json, sys, zipfile, subprocess
import cv2

ROOT=Path(__file__).resolve().parent.parent
OUT=Path(sys.argv[1] if len(sys.argv)>1 else ROOT/'output/participant-cards').resolve()
manifest=json.loads((OUT/'source/manifest.json').read_text(encoding='utf-8'))
(OUT/'cartoes').mkdir(exist_ok=True)
W,H=1080,1920
INK='#2E2428'; MUTED='#72676B'; WINE='#672C3E'; GOLD='#B58A33'; IVORY='#FAF7F0'
FONTROOT=Path('C:/Windows/Fonts')
def font(size,style='regular'):
    return ImageFont.truetype(str(FONTROOT/{'regular':'segoeui.ttf','bold':'segoeuib.ttf','serif':'georgia.ttf'}[style]),size)
def lines_for(draw,text,f,width):
    lines=[]; line=''
    for word in text.split():
        if draw.textlength(word,font=f)>width:
            if line: lines.append(line); line=''
            piece=''
            for char in word:
                if draw.textlength(piece+char,font=f)>width:
                    lines.append(piece); piece=''
                piece+=char
            line=piece
        elif line and draw.textlength(line+' '+word,font=f)>width:
            lines.append(line); line=word
        else: line=(line+' '+word).strip()
    if line:lines.append(line)
    return lines
def fit(draw,text,width,start,minsize,maxlines,style='regular'):
    for size in range(start,minsize-1,-1):
        f=font(size,style);lines=lines_for(draw,text,f,width)
        if len(lines)<=maxlines:return f,lines
    raise ValueError(f'Text exceeds allocated region: {text}')
def block(draw,text,xy,width,start=30,minsize=18,maxlines=2,style='regular',fill=INK,leading=1.18):
    f,lines=fit(draw,text,width,start,minsize,maxlines,style)
    y=xy[1]
    for line in lines:
        draw.text((xy[0],y),line,font=f,fill=fill,anchor='lt');y+=round(f.size*leading)
    return y

logo=Image.open(ROOT/'src/assets/logo-coros-diocesanos-regional.png').convert('RGBA')
logo.thumbnail((300,165),Image.Resampling.LANCZOS)
validations=[]; issues=[]
for i,c in enumerate(manifest['cards']):
    im=Image.new('RGB',(W,H),IVORY);d=ImageDraw.Draw(im)
    d.rectangle((0,0,W,9),fill=GOLD);im.paste(logo,(78,30),logo)
    d.text((540,203),'II ENCONTRO DE COROS · QUIXADÁ 2026',font=font(22,'bold'),fill=MUTED,anchor='mm')
    d.line((78,241,1002,241),fill='#DDD3C5',width=2)
    diameter=250
    d.ellipse((70,278,338,546),fill=GOLD);d.ellipse((73,281,335,543),fill=IVORY)
    if c.get('photoPath'):
        photo=ImageOps.exif_transpose(Image.open(c['photoPath'])).convert('RGB')
        photo=ImageOps.fit(photo,(diameter,diameter),method=Image.Resampling.LANCZOS,centering=(.5,.38))
        mask=Image.new('L',(diameter*4,diameter*4),0);ImageDraw.Draw(mask).ellipse((0,0,diameter*4-1,diameter*4-1),fill=255)
        mask=mask.resize((diameter,diameter),Image.Resampling.LANCZOS);im.paste(photo,(78,286),mask)
    else:
        initials=''.join(w[0] for w in c['name'].split()[:2])
        d.text((203,411),initials,font=font(74,'bold'),fill=WINE,anchor='mm')
    d.text((385,308),'PARTICIPANTE',font=font(20,'bold'),fill=WINE,anchor='lt')
    # Fit the complete identity, not each line in isolation: long badge names
    # combined with long choir/full names must never collide with lodging.
    identity=[]
    for shrink in range(100,59,-2):
        factor=shrink/100; identity=[];end=350
        specs=[(c['name'],58,'serif',INK),(c['choirName'],27,'regular',MUTED)]
        if c.get('fullName') and c['fullName']!=c['name']:specs.append((c['fullName'],23,'regular',MUTED))
        for text,size,style,fill in specs:
            f,lines=fit(d,text,615,max(17,round(size*factor)),17,2,style)
            identity.append((f,lines,end,fill))
            end+=round(f.size*1.15)*len(lines)+round(12*factor)
        if end<=568:break
    if end>568:raise ValueError(f'Identity overlaps lodging: {c["filename"]}')
    for f,lines,y,fill in identity:
        for line in lines:
            d.text((385,y),line,font=f,fill=fill,anchor='lt');y+=round(f.size*1.15)
    lodging=c.get('lodging')
    if lodging:
        label=lodging['room']+(' — '+lodging['location'] if lodging.get('location') else '')
        end=block(d,label,(78,586),924,31,23,1,'bold')
        roommates=' · '.join(lodging.get('roommates',[]))
        if roommates:
            d.text((78,end+12),'Você está hospedado com',font=font(23),fill=MUTED,anchor='lt')
            end=block(d,roommates,(78,end+46),924,29,18,2,'bold')
        if end>737:raise ValueError(f'Lodging overlaps QR: {c["filename"]}')
    d.text((540,1715),'APRESENTE À EQUIPE EM CADA ATIVIDADE',font=font(22,'bold'),fill=WINE,anchor='mm')
    d.text((540,1835),'20–22 NOV 2026 · QUIXADÁ, CE',font=font(24),fill=MUTED,anchor='mm')
    output=OUT/'cartoes'/c['filename']; selected_mask=None
    for mask in [None,*range(8)]:
        if mask is not None:
            subprocess.run(['node',str(ROOT/'scripts/write-participant-qr.mjs'),c['cardUrl'],c['qrPath'],str(mask)],check=True,capture_output=True)
        qr=Image.open(c['qrPath']).convert('RGB')
        if max(qr.size)>900:raise ValueError('Oversized QR')
        d.rounded_rectangle((78,755,1002,1679),radius=30,fill='white',outline='#DED6CA',width=2)
        im.paste(qr,(90+(900-qr.width)//2,767+(900-qr.height)//2))
        import numpy as np
        raw=cv2.cvtColor(np.asarray(im),cv2.COLOR_RGB2BGR)
        decoded,_,_=cv2.QRCodeDetector().detectAndDecode(raw)
        phone,_,_=cv2.QRCodeDetector().detectAndDecode(cv2.resize(raw,(540,960),interpolation=cv2.INTER_AREA))
        if decoded==c['cardUrl'] and phone==c['cardUrl']:
            selected_mask=mask;break
    im.save(output,optimize=True)
    passed=decoded==c['cardUrl'] and phone==c['cardUrl']
    if not passed:issues.append(c['filename'])
    validations.append({'file':c['filename'],'qrVerified':passed,'fullSizeDecoded':decoded==c['cardUrl'],'phoneDecoded':phone==c['cardUrl'],'mask':selected_mask,'size':[W,H]})
    if (i+1)%25==0: print(f'Rendered and verified {i+1}/{len(manifest["cards"])}',flush=True)
if issues:raise ValueError(f'QR validation failed: {issues}')
# Contact sheets support visual QA of every identity block without exposing token strings.
(OUT/'revisao').mkdir(exist_ok=True)
for start in range(0,len(manifest['cards']),20):
    rows=manifest['cards'][start:start+20];sheet=Image.new('RGB',(1200,((len(rows)+3)//4)*240),'#e9e4da')
    for index,c in enumerate(rows):
        thumb=Image.open(OUT/'cartoes'/c['filename']).crop((0,255,1080,745)).resize((300,136))
        x=(index%4)*300;y=(index//4)*240;sheet.paste(thumb,(x,y))
        sd=ImageDraw.Draw(sheet);block(sd,c['fullName'],(x+8,y+148),282,16,12,3,fill=INK)
    sheet.save(OUT/'revisao'/f'contatos-{start//20+1:02}.jpg',quality=90)
with zipfile.ZipFile(OUT/'cartoes-157-participantes.zip','w',zipfile.ZIP_DEFLATED) as archive:
    for c in manifest['cards']:archive.write(OUT/'cartoes'/c['filename'],'cartoes/'+c['filename'])
    archive.write(OUT/'links-cartoes.csv','links-cartoes.csv')
report={'count':len(validations),'qrVerified':sum(x['qrVerified'] for x in validations),'uniqueLinks':len({c['cardUrl'] for c in manifest['cards']}),'cards':validations}
(OUT/'validacao.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='cards'},ensure_ascii=False))
