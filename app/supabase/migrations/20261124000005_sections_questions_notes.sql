-- Phase 2 (PLAN_V2 decisions): chapters carry readable sections as well as files; important questions per
-- chapter with "I know this"; each student's own written notes per subject.

create table public.chapter_sections (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  position smallint not null check (position >= 1),
  heading text not null check (char_length(heading) between 1 and 160),
  body text not null default '' check (char_length(body) <= 20000),
  unique (chapter_id, position)
);
create index chapter_sections_text on public.chapter_sections using gin ((heading || ' ' || body) extensions.gin_trgm_ops);

create table public.important_questions (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id) on delete cascade,
  chapter_id uuid references public.chapters (id) on delete set null, -- null = general question for the subject
  position smallint not null default 1,
  question text not null check (char_length(question) between 3 and 500),
  answer text not null default '' check (char_length(answer) <= 5000),
  created_at timestamptz not null default now()
);
create index important_questions_by_chapter on public.important_questions (subject_id, chapter_id, position);

create table public.known_questions (
  user_id uuid not null references public.profiles (id) on delete cascade,
  question_id uuid not null references public.important_questions (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, question_id)
);

create table public.subject_notes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  body text not null default '' check (char_length(body) <= 20000),
  updated_at timestamptz not null default now(),
  primary key (user_id, subject_id)
);
create trigger subject_notes_touch before update on public.subject_notes for each row execute function public.touch_updated_at();

alter table public.chapter_sections enable row level security;
alter table public.important_questions enable row level security;
alter table public.known_questions enable row level security;
alter table public.subject_notes enable row level security;

create policy "sections: active users read" on public.chapter_sections for select to authenticated using (public.is_active());
create policy "sections: admins write" on public.chapter_sections for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "questions: active users read" on public.important_questions for select to authenticated using (public.is_active());
create policy "questions: admins write" on public.important_questions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "known: own rows" on public.known_questions for all to authenticated
  using (user_id = auth.uid() and public.is_active()) with check (user_id = auth.uid() and public.is_active());
create policy "notes: own rows" on public.subject_notes for all to authenticated
  using (user_id = auth.uid() and public.is_active()) with check (user_id = auth.uid() and public.is_active());
