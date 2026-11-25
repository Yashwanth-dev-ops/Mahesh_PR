-- Google sign-in: Google gives no roll number, so those users get their profile from the
-- "complete your profile" step instead of the sign-up trigger. One shared rule decides the status.

create or replace function public.roster_status(p_roll text, p_name text) returns public.user_status
language sql stable security definer set search_path = '' as $$
  select case when exists (
    select 1 from public.student_roster r
    where r.roll_no = upper(trim(p_roll))
      and lower(regexp_replace(trim(r.full_name), '\s+', ' ', 'g')) = lower(regexp_replace(trim(p_name), '\s+', ' ', 'g'))
  ) then 'active'::public.user_status else 'pending'::public.user_status end
$$;
revoke execute on function public.roster_status(text, text) from public, anon, authenticated;
grant execute on function public.roster_status(text, text) to service_role;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  m jsonb := new.raw_user_meta_data;
  roll text := upper(trim(m ->> 'roll_no'));
  nm text := trim(m ->> 'full_name');
begin
  -- OAuth sign-ups carry no roll number: their profile is created by the completion step.
  if roll is null or roll = '' then return new; end if;
  insert into public.profiles (id, full_name, roll_no, year, section, status)
  values (new.id, nm, roll, nullif(m ->> 'year', '')::smallint, upper(nullif(trim(m ->> 'section'), '')),
          public.roster_status(roll, nm));
  return new;
end $$;
