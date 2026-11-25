-- Phase 1: accounts. Profiles (one per auth user), the admin-imported roster, avatars bucket.
-- See docs/DATABASE.md §3, §4, §9 and docs/SECURITY.md.

create type public.user_role as enum ('student', 'admin');
create type public.user_status as enum ('pending', 'active', 'suspended');

-- Admin CSV allowlist. A sign-up whose roll number is here becomes active; otherwise pending.
create table public.student_roster (
  roll_no text primary key check (roll_no ~ '^[A-Z0-9]{6,15}$'),
  full_name text not null,
  branch text not null default 'AIML',
  year smallint check (year between 1 and 4),
  section text,
  imported_by uuid references auth.users (id) on delete set null,
  imported_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 80),
  roll_no text not null unique check (roll_no ~ '^[A-Z0-9]{6,15}$'),
  branch text not null default 'AIML',
  year smallint check (year between 1 and 4),
  section text check (section ~ '^[A-Z0-9]{1,3}$'),
  bio text check (char_length(bio) <= 300),
  avatar_path text,
  links jsonb not null default '{}'::jsonb,
  role public.user_role not null default 'student',
  status public.user_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Role check used by every policy. security definer so it can read profiles under RLS.
create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and status = 'active')
$$;

create function public.is_active() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'active')
$$;

-- New auth user -> profile, from sign-up metadata. Status comes from the roster, never from the client.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  m jsonb := new.raw_user_meta_data;
  roll text := upper(trim(m ->> 'roll_no'));
begin
  insert into public.profiles (id, full_name, roll_no, year, section, status)
  values (
    new.id,
    trim(m ->> 'full_name'),
    roll,
    nullif(m ->> 'year', '')::smallint,
    upper(nullif(trim(m ->> 'section'), '')),
    case when exists (select 1 from public.student_roster r where r.roll_no = roll)
         then 'active'::public.user_status else 'pending'::public.user_status end
  );
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Login by roll number: the server (service role only) turns a roll number into the account email.
-- Not callable by anon/authenticated, so roll numbers can't be probed from the browser.
create function public.email_for_roll(p_roll text) returns text
language sql stable security definer set search_path = '' as $$
  select u.email from public.profiles p join auth.users u on u.id = p.id where p.roll_no = upper(trim(p_roll))
$$;
revoke execute on function public.email_for_roll(text) from public, anon, authenticated;
grant execute on function public.email_for_roll(text) to service_role;

-- ---------- RLS ----------
alter table public.profiles enable row level security;
alter table public.student_roster enable row level security;

-- shortcut: any active user may read all profile rows (incl. roll_no); add a public view without roll_no
-- before profile pages ship in phase 2 (DATABASE.md §11).
create policy "profiles: read own, or any when active" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_active());
create policy "profiles: update own" on public.profiles for update to authenticated
  using (id = auth.uid() and public.is_active()) with check (id = auth.uid());
create policy "profiles: admins update any" on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Column-level: students may change only these columns; role, status and roll_no stay admin-only.
revoke update on public.profiles from authenticated;
grant update (full_name, bio, links, section, avatar_path) on public.profiles to authenticated;

create policy "roster: admins only" on public.student_roster for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- avatars bucket (public read, 2 MB, images only) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']);

create policy "avatars: owner writes own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: owner replaces own" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
