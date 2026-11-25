-- Phase 2: subjects → chapters → materials, plus reading progress. docs/DATABASE.md §3–§9.
-- Built to grow past the first class: everything carries branch/year/semester, counts are views (never stored),
-- and every list query has an index.

create extension if not exists pg_trgm with schema extensions;

create type public.review_status as enum ('pending', 'approved', 'rejected');
create type public.material_type as enum ('notes', 'slides', 'pdf', 'lab_record', 'link');

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9-]{3,12}$'),
  name text not null check (char_length(name) between 2 and 120),
  branch text not null default 'AIML',
  year smallint not null check (year between 1 and 4),
  semester smallint not null check (semester between 1 and 2),
  regulation text not null default 'R23',
  description text check (char_length(description) <= 500),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subjects_browse on public.subjects (branch, year, semester) where is_active;

create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id) on delete cascade,
  number smallint not null check (number between 1 and 30),
  title text not null check (char_length(title) between 2 and 160),
  created_at timestamptz not null default now(),
  unique (subject_id, number)
);

create table public.materials (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  uploader_id uuid references public.profiles (id) on delete set null,
  title text not null check (char_length(title) between 3 and 160),
  type public.material_type not null,
  file_path text,
  url text,
  file_hash text check (file_hash ~ '^[0-9a-f]{64}$'),
  mime text,
  size_bytes integer check (size_bytes between 1 and 26214400), -- 25 MB
  page_count smallint,
  status public.review_status not null default 'pending',
  reject_reason text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  download_count integer not null default 0,
  created_at timestamptz not null default now(),
  check ((type = 'link') = (url is not null)),
  check (type = 'link' or (file_path is not null and file_hash is not null))
);
create index materials_by_chapter on public.materials (chapter_id, status);
-- No duplicates (§6): the same file can never be live or waiting twice, even renamed.
create unique index materials_one_file on public.materials (file_hash) where status <> 'rejected' and file_hash is not null;
create unique index materials_one_link on public.materials (lower(url)) where status <> 'rejected' and url is not null;
create index materials_title_trgm on public.materials using gin (title extensions.gin_trgm_ops);

create table public.chapter_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  done boolean not null default false,
  last_material_id uuid references public.materials (id) on delete set null,
  last_page smallint check (last_page >= 1),
  updated_at timestamptz not null default now(),
  primary key (user_id, chapter_id)
);

create trigger subjects_touch before update on public.subjects for each row execute function public.touch_updated_at();
create trigger progress_touch before update on public.chapter_progress for each row execute function public.touch_updated_at();

-- ---------- counts (views run with the caller's rights, so RLS still applies) ----------
create view public.subject_stats with (security_invoker = true) as
select s.id as subject_id,
       count(distinct c.id)::int as chapter_count,
       count(m.id) filter (where m.status = 'approved')::int as material_count
from public.subjects s
left join public.chapters c on c.subject_id = s.id
left join public.materials m on m.chapter_id = c.id
group by s.id;

create view public.my_subject_progress with (security_invoker = true) as
select c.subject_id, count(*) filter (where p.done)::int as done_chapters
from public.chapter_progress p join public.chapters c on c.id = p.chapter_id
where p.user_id = auth.uid()
group by c.subject_id;

-- ---------- RLS (§9) ----------
alter table public.subjects enable row level security;
alter table public.chapters enable row level security;
alter table public.materials enable row level security;
alter table public.chapter_progress enable row level security;

create policy "subjects: active users read" on public.subjects for select to authenticated using (public.is_active() and (is_active or public.is_admin()));
create policy "subjects: admins write" on public.subjects for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "chapters: active users read" on public.chapters for select to authenticated using (public.is_active());
create policy "chapters: admins write" on public.chapters for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "materials: approved, own, or admin" on public.materials for select to authenticated
  using (public.is_active() and (status = 'approved' or uploader_id = auth.uid() or public.is_admin()));
-- Students add their own rows as pending only; the duplicate check and upload happen in a server action (phase 3).
create policy "materials: students add pending" on public.materials for insert to authenticated
  with check (public.is_active() and uploader_id = auth.uid() and status = 'pending' and reviewed_by is null);
create policy "materials: admins write" on public.materials for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "progress: own rows" on public.chapter_progress for all to authenticated
  using (user_id = auth.uid() and public.is_active()) with check (user_id = auth.uid() and public.is_active());

-- ---------- material files: private bucket, served only through 10-minute signed URLs ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('materials', 'materials', false, 26214400);
