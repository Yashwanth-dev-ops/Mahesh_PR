// Shared by the browser forms and the server actions, so both enforce exactly the same rules.

// Roll numbers are letters and digits (e.g. 22AB1A4201). The exact college format is not documented yet.
export const ROLL = /^[A-Z0-9]{6,15}$/;
export const YEARS = ["I year", "II year", "III year", "IV year"];
// Sign-up step 1 heading: here (not in the client form) so the server page can use it too.
export const SIGNUP_STEP1 = { kicker: "Step 1 of 2", title: "Create an account", lead: "Students on the class list get in straight away." };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const PHOTO_MAX = 2 * 1024 * 1024;

export function rollError(roll: string) {
  if (!roll) return "Enter your roll number.";
  if (!ROLL.test(roll)) return "Roll numbers use only letters and digits, 6 to 15 characters.";
}

export type SignupKey = "fullName" | "photo" | "roll" | "email" | "year" | "section" | "password" | "consent";
export type SignupErrors = Partial<Record<SignupKey, string>>;

export function readSignup(d: FormData) {
  const v = (k: SignupKey) => String(d.get(k) ?? "").trim();
  const photo = d.get("photo");
  return {
    fullName: v("fullName"),
    roll: v("roll").toUpperCase(),
    email: v("email").toLowerCase(),
    year: YEARS.indexOf(v("year")) + 1, // 0 = not chosen
    section: v("section").toUpperCase(),
    password: String(d.get("password") ?? ""),
    photo: photo instanceof File && photo.size > 0 ? photo : null,
    consent: d.get("consent") === "yes", // DPDP Act: an unticked box the student ticks themselves
  };
}

export function validateSignup(s: ReturnType<typeof readSignup>): SignupErrors {
  return {
    photo: !s.photo ? "Add a photo of yourself."
      : !PHOTO_TYPES.includes(s.photo.type) ? "Use a JPG, PNG or WebP image."
      : s.photo.size > PHOTO_MAX ? "That photo is over 2 MB. Choose a smaller one." : undefined,
    fullName: s.fullName.length < 2 || s.fullName.length > 80 ? "Enter your full name." : undefined,
    roll: rollError(s.roll),
    email: !s.email ? "Enter your email." : !EMAIL.test(s.email) || s.email.length > 120 ? "Enter an email like name@example.com." : undefined,
    year: s.year ? undefined : "Choose one.",
    section: /^[A-Z0-9]{1,3}$/.test(s.section) ? undefined : "Enter it.",
    password: s.password.length < 8 ? "Use at least 8 characters." : s.password.length > 72 ? "Use 72 characters or fewer." : undefined,
    consent: s.consent ? undefined : "Tick the box to continue.",
  };
}

export const hasErrors = (e: Record<string, string | undefined>) => Object.values(e).some(Boolean);

/** The login or sign-up form; LibraryCard reads it. */
export const AUTH_FORM_ID = "auth-form";
