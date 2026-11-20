import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({admin:vi.fn(),getUser:vi.fn(),account:vi.fn()}));
vi.mock("@/features/admin/admin-auth.server",()=>({getAdminAuthorizer:()=>({findActive:mocks.admin})}));
vi.mock("@/integrations/supabase/client.server",()=>({supabaseAdmin:{auth:{admin:{getUserById:mocks.getUser}},from:()=>{const query:any={select:()=>query,eq:()=>query,maybeSingle:mocks.account};return query;}}}));
import { getEventManagementAccess } from "./eventManagement-access.server";
beforeEach(()=>{mocks.admin.mockResolvedValue(null);mocks.getUser.mockResolvedValue({error:null,data:{user:{app_metadata:{},user_metadata:{event_report_registration_id:"registration"}}}});mocks.account.mockResolvedValue({error:null,data:{registration_id:"registration",access_status:"active",registrations:{cancelled_at:null}}});});
describe("independent scanner and report access",()=>{
 it("administration alone never bypasses the explicit report permission",async()=>{mocks.admin.mockResolvedValue({id:"admin"});expect(await getEventManagementAccess("user")).toEqual({canScan:true,canReport:false});});
 it("reports permission grants no scanner or administrative access",async()=>{mocks.getUser.mockResolvedValue({error:null,data:{user:{app_metadata:{event_report_registration_id:"registration"}}}});expect(await getEventManagementAccess("user")).toEqual({canScan:false,canReport:true});});
 it("cancelled and inactive accounts do not receive report access",async()=>{mocks.getUser.mockResolvedValue({error:null,data:{user:{app_metadata:{event_report_registration_id:"registration"}}}});mocks.account.mockResolvedValue({error:null,data:{registration_id:"registration",access_status:"active",registrations:{cancelled_at:"2026-11-20"}}});expect((await getEventManagementAccess("user")).canReport).toBe(false);});
});
