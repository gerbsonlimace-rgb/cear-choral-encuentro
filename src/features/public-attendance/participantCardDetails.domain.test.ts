import { describe, expect, it } from "vitest";
import { resolveParticipantCardLodging } from "./participantCardDetails.domain";

const roster=[{id:"a",name:"Adelmo Lopes",badge_name:"Adelmo",cancelled_at:null},{id:"b",name:"Gabriel Monteiro",badge_name:null,cancelled_at:null},{id:"c",name:"Cancelado",cancelled_at:"2026-11-20"}];
const plan={assignments:{a:"CP37",b:"CP37",c:"CP37"},named_rooms:[{key:"CP37",name:"CP37",location:"Centro de Pastoral"}],no_lodging_registration_ids:[],extra_people:[{id:"extra",name:"Acompanhante",roomKey:"CP37"}]};
describe("individual card lodging",()=>{
  it("includes only current roommates and handles a physical room name",()=>{
    expect(resolveParticipantCardLodging("a",plan,roster)).toEqual({room:"CP37",location:"Centro de Pastoral",roommates:["Gabriel Monteiro","Acompanhante"]});
  });
  it("hides stale assignments for people marked without lodging",()=>{
    expect(resolveParticipantCardLodging("a",{...plan,no_lodging_registration_ids:["a"]},roster)).toBeNull();
    expect(resolveParticipantCardLodging("a",{...plan,no_lodging_registration_ids:["b"]},roster)?.roommates).toEqual(["Acompanhante"]);
  });
  it("does not guess a physical room from legacy choir assignments",()=>{
    expect(resolveParticipantCardLodging("a",{...plan,assignments:{a:"Coro::0"}},roster)).toBeNull();
  });
});
