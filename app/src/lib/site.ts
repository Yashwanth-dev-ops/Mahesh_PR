// Product name is a placeholder until it is chosen at the end of the project (see docs/AGENTS.md).
export const APP_NAME = "StudyDashBoard";
export const APP_DESCRIPTION =
  "Chapter notes, past question papers and college notices for AI-ML students, checked by admins.";

// Privacy notice (/privacy). Change the version when the notice changes: everyone is asked to agree again.
export const PRIVACY_VERSION = "2026-11-25.2"; // .2: mobile number + admin audit log
// Where students send privacy questions and requests (DPDP Act grievance contact). Set before launch.
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "[contact email]";
