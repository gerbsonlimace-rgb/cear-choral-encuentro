import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/public-attendance.functions",()=>({searchEventAttendanceParticipants:vi.fn(),getPublicAttendanceActivities:vi.fn(),recordPublicAttendance:vi.fn(),archivePublicAttendanceCall:vi.fn().mockResolvedValue({archivedCount:12,revision:"2026-11-20T10:00:02.000000Z"}),getEventAttendanceReport:vi.fn(),lockEventManagement:vi.fn(),getPublicAttendanceConfirmation:vi.fn().mockResolvedValue({name:"Ana",fullName:"Ana Maria",choirName:"Coro São José",photoUrl:null,lodging:{room:"CP37",location:"Centro de Pastoral",roommates:[]}}),getPublicParticipantCard:vi.fn(),prepareAdminAttendanceCards:vi.fn()}));
import { PublicAttendancePage } from "./PublicAttendancePage";
import { PublicParticipantCardPage } from "./PublicParticipantCardPage";
import type { PublicAttendanceResult } from "./publicAttendance.domain";

const activity={id:"044cd7de-e6cf-4746-9a08-8a074980044d",title:"Credenciamento",activityDate:"2026-11-20",startsAt:"16:00",endsAt:"18:00",totalConfirmed:157,attended:0,revision:"2026-11-20T10:00:00.000000Z"};
const url=(char:string)=>`https://evento.test/cartao?token=${char.repeat(64)}`;
const result=(n:number):PublicAttendanceResult=>({status:"recorded",participantName:n===1?"Ana":"Bia",checkedInAt:"2026-11-20T10:00:01Z",activity:{id:activity.id,totalConfirmed:157,attended:n,revision:`2026-11-20T10:00:0${n}.000000Z`}});

describe("public attendance screen",()=>{
  it("does not expose the scanner to report-only users or reports to scanner-only users",async()=>{
    const loadActivities=vi.fn().mockResolvedValue([activity]);
    const {rerender}=render(<PublicAttendancePage canScan={true} canReport={false} loadActivities={loadActivities}/>);
    await screen.findByRole("button",{name:/Credenciamento/});expect(screen.queryByRole("tab",{name:"Relatórios"})).toBeNull();
    rerender(<PublicAttendancePage canScan={false} canReport={false} loadActivities={loadActivities}/>);
    expect(screen.queryByRole("tab",{name:"Atividades e leitor QR"})).toBeNull();
  });
  it("pauses for the participant and resumes scanning after confirmation",async()=>{
    const user=userEvent.setup(); let read!:(raw:string)=>void;
    const stop=vi.fn(), startScanner=vi.fn(async(_v,onRead)=>{read=onRead;return stop;});
    const record=vi.fn().mockResolvedValueOnce(result(1)).mockResolvedValueOnce(result(2));
    const saveLogistics=vi.fn(async({data})=>({...data,dietaryRestrictionTypes:[],dietaryRestrictionOther:null}));
    render(<PublicAttendancePage loadActivities={vi.fn().mockResolvedValue([activity])} record={record} saveLogistics={saveLogistics} startScanner={startScanner}/>);
    await user.click(await screen.findByRole("button",{name:/Credenciamento/}));
    await waitFor(()=>expect(startScanner).toHaveBeenCalledTimes(1));
    act(()=>{read(url("a"));read(url("b"));read(url("a"));});
    expect(record).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("group",{name:"Tem restrição alimentar?"})).toBeInTheDocument();
    expect(screen.getByRole("button",{name:"Retomar câmera"})).toBeDisabled();
    const food=screen.getByRole("group",{name:"Tem restrição alimentar?"});
    const van=screen.getByRole("group",{name:"Usará a van para traslado?"});
    await user.click(within(food).getByRole("radio",{name:"Não"}));
    await user.click(within(van).getByRole("radio",{name:"Não"}));
    await user.click(screen.getByRole("button",{name:"Confirmar"}));
    await waitFor(()=>expect(startScanner).toHaveBeenCalledTimes(2));
    act(()=>read(url("b")));
    await screen.findByText((_content,element)=>element?.textContent==="2 presentes / 157 total");
    expect(record).toHaveBeenCalledTimes(2);
    expect(stop).toHaveBeenCalledTimes(2);
  });
  it("shows logistics inline and clears each participant's answers",async()=>{
    const user=userEvent.setup();let read!:(raw:string)=>void;
    const stop=vi.fn(),startScanner=vi.fn(async(_v,onRead)=>{read=onRead;return stop;});
    const record=vi.fn().mockResolvedValueOnce(result(1)).mockResolvedValueOnce(result(2));
    const saveLogistics=vi.fn(async({data})=>({...data,dietaryRestrictionTypes:[],dietaryRestrictionOther:null}));
    render(<PublicAttendancePage loadActivities={vi.fn().mockResolvedValue([activity])} record={record} startScanner={startScanner} saveLogistics={saveLogistics}/>);
    await user.click(await screen.findByRole("button",{name:/Credenciamento/}));
    await waitFor(()=>expect(startScanner).toHaveBeenCalledTimes(1));
    act(()=>read(url("a")));
    const van=await screen.findByRole("group",{name:"Usará a van para traslado?"});
    const food=screen.getByRole("group",{name:"Tem restrição alimentar?"});
    expect(food).toBeVisible();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(within(food).getByRole("radio",{name:"Não"}));
    await user.click(within(van).getByRole("radio",{name:"Sim"}));
    await user.click(screen.getByRole("button",{name:"Confirmar"}));
    await waitFor(()=>expect(saveLogistics).toHaveBeenCalledWith({data:{token:"a".repeat(64),dietaryRestriction:false,dietaryRestrictionTypes:[],dietaryRestrictionOther:null,usesEventVan:true}}));
    await waitFor(()=>expect(startScanner).toHaveBeenCalledTimes(2));
    act(()=>read(url("b")));
    await screen.findByText((_content,element)=>element?.textContent==="2 presentes / 157 total");
    await waitFor(()=>expect(within(screen.getByRole("group",{name:"Usará a van para traslado?"})).getByRole("radio",{name:"Não"})).not.toBeChecked());
    expect(startScanner).toHaveBeenCalledTimes(2);
  });
  it("retains failed reads for retry and counts only server confirmations",async()=>{
    const user=userEvent.setup();let read!:(raw:string)=>void;
    const startScanner=vi.fn(async(_v,onRead)=>{read=onRead;return vi.fn();});
    const record=vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(result(1));
    render(<PublicAttendancePage loadActivities={vi.fn().mockResolvedValue([activity])} record={record} startScanner={startScanner}/>);
    await user.click(await screen.findByRole("button",{name:/Credenciamento/}));
    await waitFor(()=>expect(startScanner).toHaveBeenCalledTimes(1));
    act(()=>read(url("a")));
    await user.click(await screen.findByRole("button",{name:"Tentar pendentes novamente"}));
    expect(await screen.findByText((_content,element)=>element?.textContent==="1 presentes / 157 total")).toBeInTheDocument();
    expect(startScanner).toHaveBeenCalledTimes(1);
  });
  it("archives and zeros a call without turning off the camera",async()=>{
    const user=userEvent.setup();
    const startScanner=vi.fn(async()=>vi.fn());
    vi.spyOn(window,"confirm").mockReturnValue(true);
    render(<PublicAttendancePage canScan canArchive loadActivities={vi.fn().mockResolvedValue([{...activity,attended:12}])} startScanner={startScanner}/>);
    await user.click(await screen.findByRole("button",{name:/Credenciamento/}));
    await screen.findByRole("button",{name:"Pausar câmera"});
    await user.click(screen.getByRole("button",{name:/Arquivar e zerar/}));
    expect(await screen.findByText(/Chamada arquivada/)).toBeInTheDocument();
    expect(screen.getByRole("button",{name:"Pausar câmera"})).toBeInTheDocument();
    expect(screen.getByText((_content,element)=>element?.textContent==="0 presentes / 157 total")).toBeInTheDocument();
    expect(startScanner).toHaveBeenCalledTimes(1);
  });
  it("opens a participant card without authentication and never submits attendance",async()=>{
    const loadCard=vi.fn().mockResolvedValue({name:"Ana",choirName:"Coro São José",eligible:true,cardUrl:url("a"),qrDataUrl:"data:image/png;base64,AA=="});
    render(<PublicParticipantCardPage token={"a".repeat(64)} loadCard={loadCard}/>);
    expect(await screen.findByRole("heading",{name:"Ana"})).toBeInTheDocument();
    expect(screen.getByRole("img",{name:"QR Code individual de Ana"})).toBeInTheDocument();
    expect(screen.queryByText(/entrar|senha/i)).not.toBeInTheDocument();
  });
  it("matches the approved portrait, badge name and lodging card",async()=>{
    const loadCard=vi.fn().mockResolvedValue({name:"Ana",fullName:"Ana Maria",choirName:"Coro São José",photoUrl:"https://storage.test/ana.jpg",lodging:{room:"CP37",location:"Centro de Pastoral",roommates:["Bia"]},eligible:true,cardUrl:url("a"),qrDataUrl:"data:image/png;base64,AA=="});
    render(<PublicParticipantCardPage token={"a".repeat(64)} loadCard={loadCard}/>);
    expect(await screen.findByRole("heading",{name:"Ana"})).toBeInTheDocument();
    expect(screen.getByRole("img",{name:"Foto de Ana"})).toHaveAttribute("src","https://storage.test/ana.jpg");
    expect(screen.getByText("Ana Maria")).toBeInTheDocument();
    expect(screen.getByText(/CP37/)).toBeInTheDocument();
    expect(screen.getByText("Bia")).toBeInTheDocument();
  });
});
