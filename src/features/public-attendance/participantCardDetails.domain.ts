export type ParticipantCardLodging = { room: string; location: string; roommates: string[] };
type RosterPerson = {id: string; name: string; badge_name?: string | null; cancelled_at?: string | null};
export type CardLodgingPlan = {
  assignments?: Record<string,string>;
  named_rooms?: Array<{key:string;name:string;location?:string}>;
  no_lodging_registration_ids?: string[];
  extra_people?: Array<{id:string;name:string;roomKey?:string|null}>;
};

export function resolveParticipantCardLodging(registrationId: string, plan: CardLodgingPlan | null, roster: RosterPerson[]): ParticipantCardLodging | null {
  if (!plan || plan.no_lodging_registration_ids?.includes(registrationId)) return null;
  const key = plan.assignments?.[registrationId];
  const room = plan.named_rooms?.find(item => item.key === key);
  if (!room) return null;
  const roommates = roster.filter(person => person.id !== registrationId && !person.cancelled_at &&
    !plan.no_lodging_registration_ids?.includes(person.id) && plan.assignments?.[person.id] === key)
    .map(person => person.badge_name?.trim() || person.name);
  for (const person of plan.extra_people ?? []) if (person.id !== registrationId && person.roomKey === key && person.name.trim()) roommates.push(person.name.trim());
  return {room: room.name, location: room.location?.trim() || "", roommates};
}
