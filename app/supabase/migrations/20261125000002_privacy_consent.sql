-- India's DPDP Act 2023: record each student's consent to the privacy notice (/privacy), and which version they saw.
-- Null = never agreed (accounts made before the notice existed): the app asks once at /consent.
alter table public.profiles
  add column privacy_version text,
  add column privacy_accepted_at timestamptz;
