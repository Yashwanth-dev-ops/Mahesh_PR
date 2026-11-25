-- Rate limits for sign-in, password reset and sign-up (SECURITY.md).
-- Sign-in runs in our server action, so Supabase's own per-IP auth limit sees one address (the server's) for every
-- student. These limits count per roll number instead (and per client IP for sign-up).
create table public.rate_events (
  id bigint generated always as identity primary key,
  key text not null,                       -- 'login:22AB1A4201', 'reset:22AB1A4201', 'signup-ip:1.2.3.4'
  at timestamptz not null default now()
);
create index rate_events_key_at on public.rate_events (key, at);
create index rate_events_at on public.rate_events (at);

-- No policies: only the two functions below (run by the server with the service key) touch this table.
alter table public.rate_events enable row level security;
revoke all on public.rate_events from anon, authenticated;

-- One attempt for p_key. Under the limit: records it and returns 0. At the limit: records nothing and returns the
-- seconds until the oldest attempt in the window expires (when the next try is allowed).
create or replace function public.rate_hit(p_key text, p_limit int, p_window_seconds int) returns int
language plpgsql security definer set search_path = '' as $$
declare
  n int;
  oldest timestamptz;
  win interval := make_interval(secs => p_window_seconds);
begin
  perform pg_advisory_xact_lock(hashtext(p_key));            -- same key one at a time: no double counting
  if random() < 0.02 then                                    -- now and then, forget anything older than a day
    delete from public.rate_events where at < now() - interval '1 day';
  end if;
  select count(*), min(at) into n, oldest from public.rate_events where key = p_key and at > now() - win;
  if n >= p_limit then
    return greatest(1, ceil(extract(epoch from (oldest + win - now())))::int);
  end if;
  insert into public.rate_events (key) values (p_key);
  return 0;
end $$;

-- A correct sign-in clears that roll number's count.
create or replace function public.rate_clear(p_key text) returns void
language sql security definer set search_path = '' as $$
  delete from public.rate_events where key = p_key;
$$;

revoke execute on function public.rate_hit(text, int, int), public.rate_clear(text) from public, anon, authenticated;
grant execute on function public.rate_hit(text, int, int), public.rate_clear(text) to service_role;
