-- =============================================================================
-- Ping Board: database setup
-- Paste this whole file into Supabase -> SQL Editor -> New query, then Run.
-- Safe to run more than once.
-- =============================================================================

-- A schema that is NOT exposed through the Supabase REST API.
-- Helper functions live here so nobody can call them from the browser.
create schema if not exists private;

-- -----------------------------------------------------------------------------
-- 1. Allowlist
-- -----------------------------------------------------------------------------
create table if not exists public.allowed_emails (
  email      text primary key,
  note       text,
  created_at timestamptz not null default now()
);

-- Always store emails trimmed and lowercase, however they are typed in.
create or replace function private.normalize_allowed_email()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.email := lower(trim(new.email));
  return new;
end;
$$;

drop trigger if exists allowed_emails_normalize on public.allowed_emails;
create trigger allowed_emails_normalize
  before insert or update on public.allowed_emails
  for each row execute function private.normalize_allowed_email();

-- Lock the table: RLS on and no policies means the browser (anon or logged in)
-- can never read or change it. You manage it from the Supabase dashboard.
alter table public.allowed_emails enable row level security;
revoke all on public.allowed_emails from anon, authenticated;

-- Is this email on the allowlist? Runs with the owner's rights so it can read
-- the locked table, but only ever returns true/false.
create or replace function private.email_is_allowed(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.allowed_emails a
    where a.email = lower(trim(p_email))
  );
$$;

revoke all on function private.email_is_allowed(text) from public, anon;
grant usage on schema private to authenticated, supabase_auth_admin;
grant execute on function private.email_is_allowed(text) to authenticated, supabase_auth_admin;

-- -----------------------------------------------------------------------------
-- 2. Auth hook: refuse to create an account for any email not on the allowlist.
--    After running this file, turn it on in the dashboard:
--    Authentication -> Hooks -> "Before User Created" -> Postgres ->
--    schema "public", function "hook_before_user_created".
-- -----------------------------------------------------------------------------
create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
begin
  if private.email_is_allowed(event -> 'user' ->> 'email') then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'not-allowed: this email is not on the Ping Board allowlist'
    )
  );
end;
$$;

-- Only Supabase Auth may run the hook; it must not be callable from the browser.
revoke all on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;

-- -----------------------------------------------------------------------------
-- 3. Buttons
-- -----------------------------------------------------------------------------
create table if not exists public.buttons (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label        text not null check (char_length(btrim(label)) between 1 and 60),
  contact_name text check (contact_name is null or char_length(contact_name) <= 80),
  -- Digits only, with country code, no leading 0, 8 to 15 digits.
  phone        text not null check (phone ~ '^[1-9][0-9]{7,14}$'),
  message      text not null check (char_length(btrim(message)) between 1 and 1000),
  created_at   timestamptz not null default now()
);

create index if not exists buttons_user_id_idx on public.buttons (user_id);

alter table public.buttons enable row level security;

-- Logged-out visitors get nothing at all.
revoke all on public.buttons from anon;
grant select, insert, update, delete on public.buttons to authenticated;

-- A logged-in user only sees and changes their own rows, and only while their
-- email is still on the allowlist (removing an email cuts off access at once).
drop policy if exists "buttons_select_own" on public.buttons;
create policy "buttons_select_own" on public.buttons
  for select to authenticated
  using (
    user_id = (select auth.uid())
    and (select private.email_is_allowed(auth.jwt() ->> 'email'))
  );

drop policy if exists "buttons_insert_own" on public.buttons;
create policy "buttons_insert_own" on public.buttons
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select private.email_is_allowed(auth.jwt() ->> 'email'))
  );

drop policy if exists "buttons_update_own" on public.buttons;
create policy "buttons_update_own" on public.buttons
  for update to authenticated
  using (
    user_id = (select auth.uid())
    and (select private.email_is_allowed(auth.jwt() ->> 'email'))
  )
  with check (
    user_id = (select auth.uid())
    and (select private.email_is_allowed(auth.jwt() ->> 'email'))
  );

drop policy if exists "buttons_delete_own" on public.buttons;
create policy "buttons_delete_own" on public.buttons
  for delete to authenticated
  using (
    user_id = (select auth.uid())
    and (select private.email_is_allowed(auth.jwt() ->> 'email'))
  );

-- -----------------------------------------------------------------------------
-- 4. Add the people who may sign in (lowercase or not, it gets normalized).
--    Remove the "--" in front of the lines below, put in real emails, and run
--    just those lines. Or use Table Editor -> allowed_emails -> Insert row.
-- -----------------------------------------------------------------------------
-- insert into public.allowed_emails (email, note) values
--   ('you@example.com', 'me'),
--   ('friend@example.com', 'friend')
-- on conflict (email) do nothing;
