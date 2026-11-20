import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
const setPermission=vi.hoisted(()=>vi.fn());
vi.mock("@/lib/public-attendance.functions",()=>({setRegistrationEventManagementPermission:setPermission}));
vi.mock("sonner",()=>({toast:{success:vi.fn(),error:vi.fn()}}));
vi.mock("@/components/ui/dropdown-menu",()=>({DropdownMenuItem:({children,onSelect,disabled}:any)=><button disabled={disabled} onClick={event=>onSelect(event)}>{children}</button>}));
import { EventManagementRoleActions } from "./EventManagementRoleActions";

describe("event management permission actions",()=>{
  it("lets admins independently grant QR reading and call archiving",async()=>{
    setPermission.mockResolvedValue({enabled:true});
    const onChanged=vi.fn();
    render(<EventManagementRoleActions registrationId="registration" role={{hasAccount:true,isAdmin:false,isSelf:false}} cancelled={false} onChanged={onChanged}/>);
    fireEvent.click(screen.getByRole("button",{name:/Habilitar acesso: Leitor QR/}));
    await waitFor(()=>expect(setPermission).toHaveBeenCalledWith({data:{registrationId:"registration",permission:"scan",enabled:true}}));
    fireEvent.click(screen.getByRole("button",{name:/Habilitar acesso: Arquivar chamadas/}));
    await waitFor(()=>expect(setPermission).toHaveBeenCalledWith({data:{registrationId:"registration",permission:"archive",enabled:true}}));
    expect(onChanged).toHaveBeenCalledWith("registration","scan",true);
    expect(onChanged).toHaveBeenCalledWith("registration","archive",true);
  });
});
