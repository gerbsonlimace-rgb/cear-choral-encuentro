import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { summarizeAttendanceReport, type AttendanceReportPerson } from "./eventManagement.domain";
import { buildAttendanceReportPdf } from "./attendanceReport.pdf";
const activity={id:"044cd7de-e6cf-4746-9a08-8a074980044d",title:"Credenciamento",activityDate:"2026-11-20"};
const person=(id:string,fields:Partial<AttendanceReportPerson>={}):AttendanceReportPerson=>({id,name:`Participante ${id}`,choirName:"Coro São José",checkedInAt:null,usesEventVan:null,dietaryRestriction:null,dietaryDescription:"",...fields});
describe("event attendance reports",()=>{
  it("counts unique people by choir and keeps missing logistics separate from no",()=>{
    const report=summarizeAttendanceReport(activity,[person("a",{checkedInAt:"2026-11-20T12:00:00Z",usesEventVan:true,dietaryRestriction:true,dietaryDescription:"Leite ou lactose"}),person("b",{usesEventVan:false,dietaryRestriction:false}),person("c",{choirName:"Coro Santa Luzia"})],"2026-11-20T15:00:00Z");
    expect(report).toMatchObject({total:3,attended:1,absent:2,van:1,dietary:1,vanUnknown:1,dietaryUnknown:1});
    expect(report.choirs.find(c=>c.name==="Coro São José")).toEqual({name:"Coro São José",total:2,attended:1,absent:1});
  });
  it("exports the complete roster across multiple PDF pages including long dietary notes",async()=>{
    const rows=Array.from({length:158},(_,i)=>person(String(i),{name:`José de Albuquerque Participante ${i}`,checkedInAt:i%2?null:"2026-11-20T12:00:00Z",dietaryRestriction:i%3===0,dietaryDescription:"Outra: "+"Orientação alimentar extensa com acentos e instruções. ".repeat(6)}));
    const report=summarizeAttendanceReport(activity,rows,"2026-11-20T15:00:00Z");
    const file=await buildAttendanceReportPdf(report);
    const pdf=await PDFDocument.load(Uint8Array.from(atob(file.base64),c=>c.charCodeAt(0)));
    expect(pdf.getPageCount()).toBeGreaterThan(5);
    expect(file.fileName).toMatch(/\.pdf$/);
    expect(report.total).toBe(158);expect(report.attended).toBe(79);
  });
});
