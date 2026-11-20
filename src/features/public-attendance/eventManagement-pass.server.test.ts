import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({cookie:undefined as string|undefined,setCookie:vi.fn(),access:vi.fn(),from:vi.fn()}));
vi.mock("@tanstack/react-start/server",()=>({getCookie:()=>mocks.cookie,setCookie:mocks.setCookie,deleteCookie:()=>{mocks.cookie=undefined;},getRequest:()=>new Request("https://evento.test/chamada")}));
vi.mock("@/integrations/supabase/client.server",()=>({supabaseAdmin:{from:mocks.from}}));
vi.mock("./eventManagement-access.server",()=>({getEventManagementAccess:mocks.access}));
import { readEventManagementPass, unlockEventManagement } from "./eventManagement-pass.server";
beforeEach(()=>{vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY","test-only-secret");mocks.cookie=undefined;mocks.access.mockReset();mocks.setCookie.mockReset();
 mocks.from.mockImplementation((table:string)=>{const chain:any={select:()=>chain,eq:()=>chain,is:()=>chain,maybeSingle:async()=>({error:null,data:table==="registrations"?{id:"registration"}:{user_id:"user",access_status:"active"}})};return chain;});
});
describe("CPF lock enforced on the server",()=>{
 it("denies access without a signed pass and never reads reports",async()=>{expect(await readEventManagementPass()).toEqual({canScan:false,canReport:false});expect(mocks.access).not.toHaveBeenCalled();});
 it("creates an HttpOnly pass without CPF, rejects tampering and rechecks revoked permission",async()=>{
   mocks.access.mockResolvedValue({canScan:false,canReport:true});await unlockEventManagement("12345678909");
   const [,value,options]=mocks.setCookie.mock.calls[0];expect(options).toMatchObject({httpOnly:true,secure:true,sameSite:"strict",maxAge:28800});
   expect(value).not.toContain("12345678909");mocks.cookie=value;
   expect(await readEventManagementPass()).toEqual({canScan:false,canReport:true});
   mocks.access.mockResolvedValue({canScan:false,canReport:false});expect(await readEventManagementPass()).toEqual({canScan:false,canReport:false});
   mocks.cookie=value+"tampered";mocks.access.mockClear();expect(await readEventManagementPass()).toEqual({canScan:false,canReport:false});expect(mocks.access).not.toHaveBeenCalled();
 });
 it("does not unlock a registered person without permission",async()=>{mocks.access.mockResolvedValue({canScan:false,canReport:false});await expect(unlockEventManagement("12345678909")).rejects.toThrow("CPF não liberado");expect(mocks.setCookie).not.toHaveBeenCalled();});
});
