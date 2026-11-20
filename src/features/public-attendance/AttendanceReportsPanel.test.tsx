import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/public-attendance.functions",()=>({getEventAttendanceReport:vi.fn()}));
vi.mock("@/lib/file-download",()=>({deliverFile:vi.fn()}));
import { AttendanceReportsPanel } from "./AttendanceReportsPanel";
import { summarizeAttendanceReport } from "./eventManagement.domain";
const activity={id:"044cd7de-e6cf-4746-9a08-8a074980044d",title:"Credenciamento",activityDate:"2026-11-20",startsAt:null,endsAt:null,totalConfirmed:2,attended:1,revision:"now"};
const report=summarizeAttendanceReport(activity,[{id:"one",name:"Ana",choirName:"Coro",checkedInAt:"2026-11-20T15:00:00Z",usesEventVan:true,dietaryRestriction:true,dietaryDescription:"Leite ou lactose"},{id:"two",name:"Bia",choirName:"Coro",checkedInAt:null,usesEventVan:null,dietaryRestriction:null,dietaryDescription:""}],"2026-11-20T15:00:00Z");
describe("report lists and file sharing",()=>{
 it("prepares the PDF before enabling share and passes an actual PDF file to sharing",async()=>{
  const share=vi.fn().mockResolvedValue(undefined);Object.defineProperty(navigator,"share",{configurable:true,value:share});Object.defineProperty(navigator,"canShare",{configurable:true,value:()=>true});
  let finish!:(value:any)=>void;const loadReport=vi.fn(()=>new Promise<any>(resolve=>{finish=resolve;}));
  render(<AttendanceReportsPanel activities={[activity]} loadReport={loadReport}/>);
  expect(screen.getByRole("button",{name:"Compartilhar PDF"})).toBeDisabled();
  await act(async()=>finish({report,file:{fileName:"report.pdf",base64:btoa("%PDF-1.7")}}));
  fireEvent.click(screen.getByRole("button",{name:"Compartilhar PDF"}));
  await waitFor(()=>expect(share).toHaveBeenCalledOnce());
  const file=share.mock.calls[0][0].files[0];expect(file).toBeInstanceOf(File);expect(file.type).toBe("application/pdf");expect(file.name).toBe("report.pdf");
  fireEvent.change(screen.getByRole("combobox",{name:"Lista do relatório"}),{target:{value:"absent"}});
  expect(screen.getByText("Bia")).toBeInTheDocument();expect(screen.queryByText("Ana")).toBeNull();
 });
 it("shows detailed dietary responses without treating missing answers as no",async()=>{
  const loadReport=vi.fn().mockResolvedValue({report,file:{fileName:"report.pdf",base64:btoa("%PDF")}});
  render(<AttendanceReportsPanel activities={[activity]} loadReport={loadReport}/>);
  await screen.findByText(/Atualizado às/);
  fireEvent.change(screen.getByRole("combobox",{name:"Lista do relatório"}),{target:{value:"dietary"}});
  expect(screen.getByText("Leite ou lactose")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox",{name:"Lista do relatório"}),{target:{value:"vanUnknown"}});
  expect(screen.getByText("Bia")).toBeInTheDocument();expect(screen.queryByText("Ana")).toBeNull();
 });
});
