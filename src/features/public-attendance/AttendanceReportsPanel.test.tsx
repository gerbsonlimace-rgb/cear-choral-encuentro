import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/public-attendance.functions",()=>({getEventAttendanceReport:vi.fn()}));
vi.mock("@/lib/file-download",()=>({deliverFile:vi.fn()}));
import { AttendanceReportsPanel } from "./AttendanceReportsPanel";
import { summarizeAttendanceReport } from "./eventManagement.domain";
const activity={id:"044cd7de-e6cf-4746-9a08-8a074980044d",title:"Credenciamento",activityDate:"2026-11-20",startsAt:null,endsAt:null,totalConfirmed:2,attended:1,revision:"now"};
const report=summarizeAttendanceReport(activity,[{id:"one",name:"Ana",choirName:"Coro",checkedInAt:"2026-11-20T15:00:00Z",usesEventVan:true,dietaryRestriction:true,dietaryDescription:"Leite ou lactose"},{id:"two",name:"Bia",choirName:"Coro",checkedInAt:null,usesEventVan:null,dietaryRestriction:null,dietaryDescription:""}],"2026-11-20T15:00:00Z");
describe("attendance report navigation and sharing",()=>{
 it("shows compact activity totals before loading the detailed report",async()=>{
  const loadReport=vi.fn().mockResolvedValue({report,file:{fileName:"report.pdf",base64:btoa("%PDF")}});
  render(<AttendanceReportsPanel activities={[activity]} loadReport={loadReport}/>);
  expect(screen.getByText((_text,element)=>element?.tagName==="P"&&element.textContent?.includes("1 presentes")===true)).toBeInTheDocument();expect(screen.getByText((_text,element)=>element?.tagName==="P"&&element.textContent?.includes("2 total")===true)).toBeInTheDocument();
  expect(loadReport).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button",{name:/Credenciamento/}));
  await screen.findByText("Ana");expect(await screen.findByText("Bia")).toBeInTheDocument();
  expect(screen.getByText("Coro")).toBeInTheDocument();expect(screen.getByText("1 presentes · 1 faltantes")).toBeInTheDocument();
  expect(loadReport).toHaveBeenCalledOnce();
 });
 it("opens the chosen WhatsApp contact with the full list grouped by choir",async()=>{
  const loadReport=vi.fn().mockResolvedValue({report,file:{fileName:"report.pdf",base64:btoa("%PDF")}});
  const open=vi.spyOn(window,"open").mockReturnValue({} as Window);
  render(<AttendanceReportsPanel activities={[activity]} loadReport={loadReport}/>);
  fireEvent.click(screen.getByRole("button",{name:/Credenciamento/}));
  await screen.findByText("Ana");
  fireEvent.change(screen.getByLabelText(/WhatsApp de destino/),{target:{value:"+55 (85) 99999-1234"}});
  fireEvent.click(screen.getByRole("button",{name:/Compartilhar no WhatsApp/}));
  await waitFor(()=>expect(open).toHaveBeenCalledOnce());
  const url=new URL(String(open.mock.calls[0][0]));
  expect(url.pathname).toBe("/5585999991234");expect(url.searchParams.get("text")).toContain("Coro (1/2 presentes");
  expect(url.searchParams.get("text")).toContain("Ana: Presente");expect(url.searchParams.get("text")).toContain("Bia: Faltante");
 });
 it("prepares a PDF only after opening a call and allows sharing it",async()=>{
  const share=vi.fn().mockResolvedValue(undefined);Object.defineProperty(navigator,"share",{configurable:true,value:share});Object.defineProperty(navigator,"canShare",{configurable:true,value:()=>true});
  let finish!:(value:any)=>void;const loadReport=vi.fn(()=>new Promise<any>(resolve=>{finish=resolve;}));
  render(<AttendanceReportsPanel activities={[activity]} loadReport={loadReport}/>);
  fireEvent.click(screen.getByRole("button",{name:/Credenciamento/}));
  await waitFor(()=>expect(loadReport).toHaveBeenCalledOnce());
  expect(screen.getByRole("button",{name:"Compartilhar PDF"})).toBeDisabled();
  await act(async()=>finish({report,file:{fileName:"report.pdf",base64:btoa("%PDF-1.7")}}));
  fireEvent.click(screen.getByRole("button",{name:"Compartilhar PDF"}));
  await waitFor(()=>expect(share).toHaveBeenCalledOnce());
  const file=share.mock.calls[0][0].files[0];expect(file).toBeInstanceOf(File);expect(file.type).toBe("application/pdf");expect(file.name).toBe("report.pdf");
 });
});
