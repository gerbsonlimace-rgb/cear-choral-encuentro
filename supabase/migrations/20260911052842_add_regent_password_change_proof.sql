alter table public.choir_regents
  add column password_change_retry_token_hash text;

alter table public.choir_regents
  add constraint choir_regents_password_change_retry_hash_check check (
    password_change_retry_token_hash is null
    or password_change_retry_token_hash ~ '^[0-9a-f]{64}$'
  ),
  add constraint choir_regents_password_change_retry_state_check check (
    password_change_required or password_change_retry_token_hash is null
  );
