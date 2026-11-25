-- Email confirmation is off until a mail service is connected (Supabase's built-in mail only reaches team
-- members). So a roster roll number alone must not activate an account: the name must match too,
-- otherwise anyone could claim a classmate's roll number. Mismatches wait for an admin as 'pending'.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  m jsonb := new.raw_user_meta_data;
  roll text := upper(trim(m ->> 'roll_no'));
  nm text := trim(m ->> 'full_name');
begin
  insert into public.profiles (id, full_name, roll_no, year, section, status)
  values (
    new.id, nm, roll,
    nullif(m ->> 'year', '')::smallint,
    upper(nullif(trim(m ->> 'section'), '')),
    case when exists (
      select 1 from public.student_roster r
      where r.roll_no = roll
        and lower(regexp_replace(r.full_name, '\s+', ' ', 'g')) = lower(regexp_replace(nm, '\s+', ' ', 'g'))
    ) then 'active'::public.user_status else 'pending'::public.user_status end
  );
  return new;
end $$;
