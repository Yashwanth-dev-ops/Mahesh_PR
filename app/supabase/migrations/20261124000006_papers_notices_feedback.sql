-- Pilot (CEO_REVIEW.md): past papers per subject, admin notices, student feedback. DATABASE.md §3–§9.

create type public.paper_kind as enum ('previous', 'regular');
create type public.exam_type as enum ('regular', 'supplementary', 'mid1', 'mid2');
create type public.notice_category as enum ('notice', 'exam', 'event', 'campaign', 'placement');

create table public.question_papers (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id) on delete cascade,
  kind public.paper_kind not null default 'previous',
  exam_type public.exam_type not null,
  regulation text not null default 'R23',
  exam_year smallint not null check (exam_year between 2000 and 2100),
  exam_month smallint not null check (exam_month between 1 and 12),
  file_path text not null,
  file_hash text not null check (file_hash ~ '^[0-9a-f]{64}$'),
  size_bytes integer check (size_bytes between 1 and 26214400),
  page_count smallint,
  uploader_id uuid references public.profiles (id) on delete set null,
  status public.review_status not null default 'pending',
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  download_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index papers_browse on public.question_papers (subject_id, kind, regulation, exam_year) where status = 'approved';
create unique index papers_one_file on public.question_papers (file_hash) where status <> 'rejected';
create unique index papers_one_slot on public.question_papers (subject_id, kind, exam_type, regulation, exam_year, exam_month) where status = 'approved';

create table public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 140),
  body text not null default '' check (char_length(body) <= 4000),
  category public.notice_category not null default 'notice',
  pinned boolean not null default false,
  publish_at timestamptz not null default now(),
  expires_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (expires_at is null or expires_at > publish_at)
);
create index notices_live on public.notices (pinned desc, publish_at desc);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  message text not null check (char_length(message) between 3 and 2000),
  page text check (char_length(page) <= 200),
  created_at timestamptz not null default now()
);

alter table public.question_papers enable row level security;
alter table public.notices enable row level security;
alter table public.feedback enable row level security;

create policy "papers: approved, own, or admin" on public.question_papers for select to authenticated
  using (public.is_active() and (status = 'approved' or uploader_id = auth.uid() or public.is_admin()));
create policy "papers: admins write" on public.question_papers for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Students see live notices only; admins see all (including scheduled and expired).
create policy "notices: live for active users" on public.notices for select to authenticated
  using (public.is_admin() or (public.is_active() and publish_at <= now() and (expires_at is null or expires_at > now())));
create policy "notices: admins write" on public.notices for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Feedback: students add their own; only admins read it.
create policy "feedback: add own" on public.feedback for insert to authenticated with check (user_id = auth.uid() and public.is_active());
create policy "feedback: admins read" on public.feedback for select to authenticated using (public.is_admin());

-- Paper files live in their own private bucket, served by 10-minute signed links like materials.
insert into storage.buckets (id, name, public, file_size_limit) values ('papers', 'papers', false, 26214400);
