-- Physical-room metadata; existing plans retain their choir-based layout.
alter table public.lodging_plan
  add column named_rooms jsonb not null default '[]'::jsonb
  constraint lodging_plan_named_rooms_array check (jsonb_typeof(named_rooms) = 'array');
