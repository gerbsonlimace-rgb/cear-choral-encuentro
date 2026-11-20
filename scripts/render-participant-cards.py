"""Render the approved 1080x1920 card with real QR images, then decode every result.
The reference is the approved avatar-left card from the WhatsApp chat. This is
deterministic template/data composition, not AI generation or photo retouching.
Usage: python scripts/render-participant-cards.py [output/participant-cards]
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps
import json, sys, zipfile, subprocess
import cv2
import numpy as np

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

def bed_icon(draw,x,y):
    # Same simple double-bed geometry as the public card's Lucide BedDouble.
    draw.rounded_rectangle((x+7,y+9,x+61,y+37),radius=5,outline=WINE,width=4)
    draw.rounded_rectangle((x,y+31,x+68,y+59),radius=5,outline=WINE,width=4)
    draw.line((x,y+47,x+68,y+47),fill=WINE,width=4)
    draw.line((x,y+58,x,y+67),fill=WINE,width=4)
    draw.line((x+68,y+58,x+68,y+67),fill=WINE,width=4)
    draw.line((x+34,y+12,x+34,y+29),fill=WINE,width=4)

logo=Image.open(ROOT/'src/assets/logo-coros-diocesanos-regional.png').convert('RGBA')
logo.thumbnail((300,165),Image.Resampling.LANCZOS)
validations=[]; issues=[]
for i,c in enumerate(manifest['cards']):
    sequence=int(c.get('sequenceNumber',0))
    if sequence<1:raise ValueError(f'Missing list sequence number: {c["filename"]}')
    im=Image.new('RGB',(W,H),IVORY);d=ImageDraw.Draw(im)
    d.rectangle((0,0,W,9),fill=GOLD);im.paste(logo,(78,30),logo)
    d.rounded_rectangle((820,30,1002,154),radius=24,fill=WINE,outline=GOLD,width=4)
    d.text((911,85),f'{sequence:03d}',font=font(48,'bold'),fill=IVORY,anchor='mm')
    d.text((911,127),'Nº DA LISTA',font=font(14,'bold'),fill='#F2D68B',anchor='mm')
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
        d.line((78,1384,1002,1384),fill=GOLD,width=2)
        bed_icon(d,78,1415)
        d.text((168,1408),'SUA ACOMODAÇÃO',font=font(21,'bold'),fill=WINE,anchor='lt')
        end=block(d,lodging['room'],(168,1441),834,56,34,2,'bold',fill=WINE)
        if lodging.get('location'):
            end=block(d,lodging['location'],(78,end+15),924,28,22,2)
        roommates=' · '.join(lodging.get('roommates',[]))
        if roommates:
            d.text((78,end+16),'Você está hospedado com',font=font(25),fill=MUTED,anchor='lt')
            end=block(d,roommates,(78,end+53),924,30,20,4,'bold')
        if end>1780:raise ValueError(f'Lodging overlaps footer: {c["filename"]}')
    d.text((540,1345),'APRESENTE À EQUIPE EM CADA ATIVIDADE',font=font(22,'bold'),fill=WINE,anchor='mm')
    d.text((540,1835),'20–22 NOV 2026 · QUIXADÁ, CE',font=font(24),fill=MUTED,anchor='mm')
    output=OUT/'cartoes'/c['filename']; selected_mask=None
    for mask in [None,*range(8)]:
        if mask is not None:
            subprocess.run(['node',str(ROOT/'scripts/write-participant-qr.mjs'),c['cardUrl'],c['qrPath'],str(mask)],check=True,capture_output=True)
        qr=Image.open(c['qrPath']).convert('RGB')
        # Integer module scaling keeps the smaller QR crisp and its quiet zone intact.
        # Source images always include the four-module border from write-participant-qr.
        source=np.asarray(qr)
        first_black=np.where(source[0:source.shape[0]//2,:,0]<128)
        if not first_black[0].size:raise ValueError('QR has no modules')
        old_scale=int(first_black[0].min())//4
        module_count=qr.width//old_scale
        new_scale=700//module_count
        qr=qr.resize((module_count*new_scale,module_count*new_scale),Image.Resampling.NEAREST)
        d.rounded_rectangle((178,590,902,1314),radius=30,fill='white',outline='#DED6CA',width=2)
        im.paste(qr,(190+(700-qr.width)//2,602+(700-qr.height)//2))
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
        sd=ImageDraw.Draw(sheet);block(sd,f'{int(c["sequenceNumber"]):03d} · {c["fullName"]}',(x+8,y+148),282,16,12,3,fill=INK)
    sheet.save(OUT/'revisao'/f'contatos-{start//20+1:02}.jpg',quality=90)
with zipfile.ZipFile(OUT/f'cartoes-{len(manifest["cards"])}-participantes.zip','w',zipfile.ZIP_DEFLATED) as archive:
    for c in manifest['cards']:archive.write(OUT/'cartoes'/c['filename'],'cartoes/'+c['filename'])
    archive.write(OUT/'links-cartoes.csv','links-cartoes.csv')
report={'count':len(validations),'qrVerified':sum(x['qrVerified'] for x in validations),'uniqueLinks':len({c['cardUrl'] for c in manifest['cards']}),'cards':validations}
(OUT/'validacao.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='cards'},ensure_ascii=False))
