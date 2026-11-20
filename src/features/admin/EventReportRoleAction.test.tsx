import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
const setAccess=vi.hoisted(()=>vi.fn());
vi.mock("@/lib/public-attendance.functions",()=>({setRegistrationEventReportAccess:setAccess}));
vi.mock("sonner",()=>({toast:{success:vi.fn(),error:vi.fn()}}));
vi.mock("@/components/ui/dropdown-menu",()=>({DropdownMenuItem:({children,onSelect,disabled}:any)=><button disabled={disabled} onClick={event=>onSelect(event)}>{children}</button>}));
import { EventReportRoleAction } from "./EventReportRoleAction";
describe("event report permission action",()=>{
 it("updates parent permission after grant so reopening the menu can revoke it",async()=>{
  setAccess.mockResolvedValueOnce({enabled:true}).mockResolvedValueOnce({enabled:false});const onChanged=vi.fn();
  const role={hasAccount:true,isAdmin:false,isSelf:false,isEventReports:false};
  const {rerender}=render(<EventReportRoleAction registrationId="registration" role={role} cancelled={false} onChanged={onChanged}/>);
  fireEvent.click(screen.getByRole("button",{name:/Habilitar Gerenciamento/}));
  await waitFor(()=>expect(onChanged).toHaveBeenCalledWith("registration",true));
  rerender(<EventReportRoleAction key="reopened" registrationId="registration" role={{...role,isEventReports:true}} cancelled={false} onChanged={onChanged}/>);
  fireEvent.click(screen.getByRole("button",{name:/Remover Gerenciamento/}));
  await waitFor(()=>expect(setAccess).toHaveBeenLastCalledWith({data:{registrationId:"registration",enabled:false}}));
 });
});
