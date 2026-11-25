-- Admin v3 (approved in Figma 2026-11-25): student phone numbers, block reasons, one main admin who invites
-- other admins by email, bulk registration's email queue, and an append-only audit log.

-- 1. Profiles: phone (10-digit Indian mobile, admins and the student only: the read policy is already
--    "own row or admin"), the reason shown to admins when a student is blocked, and the one main admin.
--    Students still can't write these columns themselves (only bio, links are granted); server actions do.
alter table public.profiles add column phone text check (phone ~ '^[6-9][0-9]{9}$');
alter table public.profiles add column status_reason text check (char_length(status_reason) <= 200);
alter table public.profiles add column is_owner boolean not null default false;
create unique index profiles_one_owner on public.profiles (is_owner) where is_owner;

-- Sign-up carries the phone in the account metadata; a malformed one is dropped rather than failing sign-up
-- (the consent page asks again).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  m jsonb := new.raw_user_meta_data;
  roll text := upper(trim(m ->> 'roll_no'));
  nm text := trim(m ->> 'full_name');
  ph text := regexp_replace(coalesce(m ->> 'phone', ''), '\D', '', 'g');
begin
  -- OAuth sign-ups and admin accounts carry no roll number: their profile is created by the server.
  if roll is null or roll = '' then return new; end if;
  if ph !~ '^[6-9][0-9]{9}$' then ph := null; end if;
  insert into public.profiles (id, full_name, roll_no, year, section, status, phone)
  values (new.id, nm, roll, nullif(m ->> 'year', '')::smallint, upper(nullif(trim(m ->> 'section'), '')),
          public.roster_status(roll, nm), ph);
  return new;
end $$;

-- 2. Audit log: written only by the server (service role), read by admins, and never edited or deleted,
--    not even by the service role, except rows older than a year (the retention the privacy notice states).
create table public.admin_audit (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  admin_id uuid,                       -- no foreign key: the entry outlives the admin's account
  admin_label text not null,           -- name at the time, so the log still reads after a rename or removal
  action text not null,
  target text,
  details text
);
create index admin_audit_at on public.admin_audit (at desc);
alter table public.admin_audit enable row level security;
create policy "audit: admins read" on public.admin_audit for select to authenticated using (public.is_admin());
revoke all on public.admin_audit from anon, authenticated;
grant select on public.admin_audit to authenticated;

create function public.audit_append_only() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and old.at < now() - interval '1 year' then return old; end if;
  raise exception 'audit log entries cannot be changed or deleted';
end $$;
create trigger admin_audit_append_only before update or delete on public.admin_audit
  for each row execute function public.audit_append_only();

-- 3. Admin invitations: the main admin invites by email; the person sets a password from the emailed link.
create table public.admin_invites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null check (char_length(full_name) between 2 and 80),
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
alter table public.admin_invites enable row level security;
create policy "invites: admins read" on public.admin_invites for select to authenticated using (public.is_admin());
revoke all on public.admin_invites from anon, authenticated;
grant select on public.admin_invites to authenticated;

-- 4. Set-password emails waiting to go out (bulk registration sends at most 60 an hour through Gmail).
create table public.welcome_emails (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
alter table public.welcome_emails enable row level security; -- no policies: server only
revoke all on public.welcome_emails from anon, authenticated;
