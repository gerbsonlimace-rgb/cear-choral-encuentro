import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({rpc:vi.fn(),activity:vi.fn(),cards:vi.fn(),presences:vi.fn()}));
vi.mock("@/integrations/supabase/client.server",()=>({supabaseAdmin:{rpc:mocks.rpc,from:(name:string)=>{const result=name==="event_activities"?mocks.activity:name==="registration_attendance_cards"?mocks.cards:mocks.presences;const chain:any={select:()=>chain,eq:()=>chain,in:result,maybeSingle:result};return chain;}}}));
import { searchAttendanceParticipants } from "./attendanceSearch.server";
const ids=["d5cece4a-1281-4c5b-8396-9af4d2b84a46","36e6cd0c-76b5-4a00-b8f6-4e6a3d304856","4fdb3101-4f7b-46c5-aa3d-ece0abaafacf"];
beforeEach(()=>{
 mocks.activity.mockResolvedValue({data:{id:"activity"},error:null});
 mocks.rpc.mockResolvedValue({error:null,data:{registrations:ids.map((id,i)=>({id,name:"Antônio Lima",badge_name:null,choir_name:"Coro",payment_status:i===1?"pending":"paid",cancelled_at:i===2?"cancelled":null,cpf:"private",email:"private"}))}});
 mocks.cards.mockResolvedValue({data:[{registration_id:ids[0],token:"a".repeat(64)}],error:null});mocks.presences.mockResolvedValue({data:[{registration_id:ids[0]}],error:null});
});
describe("server attendance name search",()=>{
 it("matches accents and reversed name parts, includes only confirmed active registrations, and returns no private fields",async()=>{
  const result=await searchAttendanceParticipants("activity","lima antonio");
  expect(result).toEqual([{name:"Antônio Lima",choirName:"Coro",token:"a".repeat(64),attended:true}]);
  expect(mocks.cards).toHaveBeenCalledWith("registration_id",[ids[0]]);
 });
 it("rejects unavailable activities and does not expose card tokens",async()=>{
  mocks.activity.mockResolvedValue({data:null,error:null});await expect(searchAttendanceParticipants("activity","antonio")).rejects.toThrow();expect(mocks.cards).not.toHaveBeenCalled();
 });
});
