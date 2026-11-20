import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { adminPdfLogoBase64 } from "@/features/admin/admin-pdf-logo";
import type { AttendanceReport } from "./eventManagement.domain";

export async function buildAttendanceReportPdf(report: AttendanceReport) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = await doc.embedPng(adminPdfLogoBase64);
  const ink=rgb(.12,.12,.13),muted=rgb(.38,.38,.4),rule=rgb(.83,.83,.84);
  const safe = (value: string) => [...value.normalize("NFC").replace(/[\n\r\t]/g," ")].map(char => {try {font.encodeText(char);return char;}catch{return "?";}}).join("");
  const wrap = (value: string, width: number, face: PDFFont, size: number) => {
    const lines: string[]=[];let line="";
    for (const char of safe(value || "-")) {
      if (face.widthOfTextAtSize(line+char,size)>width && line) { const split=line.lastIndexOf(" "); if(split>0){lines.push(line.slice(0,split));line=line.slice(split+1);}else{lines.push(line);line="";} }
      line+=char;
    }
    if(line)lines.push(line.trim());return lines.length?lines:["-"];
  };
  const stamp = new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Fortaleza",dateStyle:"short",timeStyle:"short"}).format(new Date(report.generatedAt));
  let page=doc.addPage([595,842]),y=0;
  const text=(value:string,x:number,top:number,size=9,face=font,color=ink)=>page.drawText(safe(value),{x,y:top,font:face,size,color});
  function header() {
    page.drawImage(logo,{x:32,y:777,...logo.scaleToFit(90,48)});
    text("II Encontro de Coros",138,808,16,bold);
    text("Gerenciamento do evento | Relatório de presença",138,791,9);
    y=760;
    for(const line of wrap(report.activity.title,531,bold,13)){text(line,32,y,13,bold);y-=17;}
    text(`Atividade: ${report.activity.activityDate.split("-").reverse().join("/")} | Emitido em ${stamp}`,32,y-2,8,font,muted);y-=26;
  }
  function newPage(){page=doc.addPage([595,842]);header();}
  function ensure(height:number){if(y-height<45)newPage();}
  function section(title:string){ensure(55);y-=10;text(title,32,y,12,bold);y-=22;}
  function table(headers:string[],widths:number[],rows:string[][]){
    const tableHead=()=>{ensure(28);page.drawRectangle({x:32,y:y-20,width:531,height:22,color:rgb(.95,.95,.94)});let x=37;headers.forEach((label,i)=>{text(label,x,y-12,8,bold);x+=widths[i];});y-=24;};
    tableHead();
    if(!rows.length){text("Nenhum participante nesta lista.",37,y-10,9,font,muted);y-=30;return;}
    for(const row of rows){
      const lines=row.map((cell,i)=>wrap(cell,widths[i]-12,font,9));const height=Math.max(...lines.map(cell=>cell.length))*12+12;
      if(y-height<45){newPage();tableHead();}
      let x=37;lines.forEach((cell,i)=>{cell.forEach((line,j)=>text(line,x,y-12-j*12));x+=widths[i];});y-=height;
      page.drawLine({start:{x:32,y},end:{x:563,y},thickness:.4,color:rule});
    }
  }
  header();
  section("Resumo da atividade");
  table(["Inscritos confirmados","Presentes","Ausentes"],[205,163,163],[[String(report.total),String(report.attended),String(report.absent)]]);
  text(`Van: ${report.van} sim; ${report.vanUnknown} não informados. Alimentação: ${report.dietary} com restrição; ${report.dietaryUnknown} não informados.`,32,y-12,8,font,muted);y-=34;
  section("Total por coro");
  table(["Coro","Inscritos","Presentes","Ausentes"],[300,77,77,77],report.choirs.map(c=>[c.name,String(c.total),String(c.attended),String(c.absent)]));
  const people=(title:string,rows:AttendanceReport["people"],detail?:(person:AttendanceReport["people"][number])=>string)=>{
    section(`${title} (${rows.length})`);
    table(detail?["Participante","Coro","Informação"]:["Participante","Coro"],detail?[175,175,181]:[265,266],rows.map(p=>detail?[p.name,p.choirName,detail(p)]:[p.name,p.choirName]));
  };
  people("Presenças confirmadas",report.people.filter(p=>p.checkedInAt),p=>new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Fortaleza",dateStyle:"short",timeStyle:"short"}).format(new Date(p.checkedInAt!)));
  people("Ainda não confirmaram presença",report.people.filter(p=>!p.checkedInAt));
  people("Participantes que usarão a van",report.people.filter(p=>p.usesEventVan===true));
  people("Participantes com restrição alimentar",report.people.filter(p=>p.dietaryRestriction===true),p=>p.dietaryDescription);
  people("Van: resposta não informada",report.people.filter(p=>p.usesEventVan===null));
  people("Alimentação: resposta não informada",report.people.filter(p=>p.dietaryRestriction===null));
  doc.getPages().forEach((p,i)=>p.drawText(`Página ${i+1} de ${doc.getPageCount()} | Somente inscrições confirmadas e não canceladas`,{x:32,y:25,font,size:8,color:muted}));
  doc.setTitle(`Presenças - ${safe(report.activity.title)}`);
  return { fileName:`relatorio-presencas-${report.activity.id.slice(0,8)}-${report.generatedAt.slice(0,10)}.pdf`,base64:await doc.saveAsBase64() };
}
