import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/public-attendance.functions",()=>({getPublicAttendanceActivities:vi.fn(),recordPublicAttendance:vi.fn(),getPublicAttendanceConfirmation:vi.fn().mockResolvedValue({name:"Ana",fullName:"Ana Maria",choirName:"Coro São José",photoUrl:null,lodging:{room:"CP37",location:"Centro de Pastoral",roommates:[]}}),getPublicParticipantCard:vi.fn(),prepareAdminAttendanceCards:vi.fn()}));
import { PublicAttendancePage } from "./PublicAttendancePage";
import { PublicParticipantCardPage } from "./PublicParticipantCardPage";
import type { PublicAttendanceResult } from "./publicAttendance.domain";

const activity={id:"044cd7de-e6cf-4746-9a08-8a074980044d",title:"Credenciamento",activityDate:"2026-11-20",startsAt:"16:00",endsAt:"18:00",totalConfirmed:157,attended:0,revision:"2026-11-20T10:00:00.000000Z"};
const url=(char:string)=>`https://evento.test/cartao?token=${char.repeat(64)}`;
const result=(n:number):PublicAttendanceResult=>({status:"recorded",participantName:n===1?"Ana":"Bia",checkedInAt:"2026-11-20T10:00:01Z",activity:{id:activity.id,totalConfirmed:157,attended:n,revision:`2026-11-20T10:00:0${n}.000000Z`}});

describe("public attendance screen",()=>{
  it("lists activities without login and continuously scans while confirmations are pending",async()=>{
    const user=userEvent.setup(); let read!:(raw:string)=>void;
    const stop=vi.fn(), startScanner=vi.fn(async(_v,onRead)=>{read=onRead;return stop;});
    const resolvers:Array<(r:PublicAttendanceResult)=>void>=[];
    const record=vi.fn(()=>new Promise<PublicAttendanceResult>(ok=>resolvers.push(ok)));
    render(<PublicAttendancePage loadActivities={vi.fn().mockResolvedValue([activity])} record={record} startScanner={startScanner}/>);
    await user.click(await screen.findByRole("button",{name:/Credenciamento/}));
    await waitFor(()=>expect(startScanner).toHaveBeenCalledTimes(1));
    act(()=>{read(url("a"));read(url("b"));read(url("a"));});
    expect(record).toHaveBeenCalledTimes(2);
    expect(screen.getByText("0 de 157 presentes")).toBeInTheDocument();
    expect(screen.getByText(/2 leituras aguardando/)).toBeInTheDocument();
    await act(async()=>{resolvers[1](result(2));});
    await act(async()=>{resolvers[0](result(1));});
    expect(screen.getByText("2 de 157 presentes")).toBeInTheDocument();
    expect(startScanner).toHaveBeenCalledTimes(1); expect(stop).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button",{name:"Pausar câmera"}));
    expect(stop).toHaveBeenCalledTimes(1);
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
    expect(await screen.findByText("1 de 157 presentes")).toBeInTheDocument();
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
