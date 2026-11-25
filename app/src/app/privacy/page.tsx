import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME, CONTACT_EMAIL, PRIVACY_VERSION } from "@/lib/site";
import "./privacy.css";

export const metadata: Metadata = { title: `Privacy · ${APP_NAME}`, description: `How ${APP_NAME} uses your personal data, and your rights under India's DPDP Act 2023.` };

const DATA = [
  ["Your name and roll number", "To sign you in and check you against the class list from the college."],
  ["Your email", "For account messages: password resets and “your account is approved”."],
  ["Your year and section", "To show you the right subjects and notices."],
  ["Your photo", "For your library card inside the app."],
  ["What you study", "Chapters you finish, the page you stopped at, questions you mark “I know this”, and your notes. Only to show your progress and bring you back where you left off."],
  ["Feedback you send", "To fix problems and improve the app."],
  ["Sign-in attempts", "To stop password guessing. Kept for one day."],
];

/** Privacy notice (DPDP Act 2023). Plain language, one page, versioned: students agree to PRIVACY_VERSION. */
export default function PrivacyPage() {
  return (
    <div className="pv-page">
      <header className="pv-top">
        <Link href="/" className="pv-home"><span className="pv-mark" aria-hidden="true">{APP_NAME[0]}</span>{APP_NAME}</Link>
      </header>
      <main className="pv-main">
        <article className="pv-doc">
          <p className="pv-kicker">Privacy notice · version {PRIVACY_VERSION}</p>
          <h1>How we use your data</h1>
          <p className="pv-lead">
            {APP_NAME} is a study library for your branch, run by the library admins. This page says what we collect,
            why, who sees it, and how to download or delete it. It follows India&apos;s Digital Personal Data Protection
            Act, 2023.
          </p>

          <h2>What we collect and why</h2>
          <table className="pv-table">
            <thead><tr><th scope="col">What</th><th scope="col">Why</th></tr></thead>
            <tbody>{DATA.map(([what, why]) => <tr key={what}><th scope="row">{what}</th><td>{why}</td></tr>)}</tbody>
          </table>
          <p>We don&apos;t sell your data, show you targeted ads, or share it with anyone outside the services below.</p>

          <h2>Who can see it</h2>
          <ul>
            <li><strong>You</strong> see everything about yourself.</li>
            <li><strong>Library admins</strong> see your name, roll number, year, section and whether your account is approved, so they can approve sign-ups. They don&apos;t read your notes.</li>
            <li><strong>Other students</strong> see nothing of yours.</li>
          </ul>

          <h2>Where it is kept</h2>
          <ul>
            <li>Our database and files are with Supabase, in Mumbai, India. The website runs on Vercel.</li>
            <li>If you sign in with Google, Google tells us your name and email.</li>
            <li>Account emails are sent through our email account (Gmail).</li>
            <li>A weekly backup, encrypted before it leaves our computer, is kept in Google Drive for 8 weeks so nothing is lost if something breaks.</li>
          </ul>

          <h2>How long we keep it</h2>
          <p>
            While your account exists. When you delete your account, your profile, photo, notes, progress and feedback
            are removed straight away. Copies inside the encrypted backups disappear as those backups expire, within
            8 weeks. The class list itself comes from the college and stays with the admins.
          </p>

          <h2>Your rights</h2>
          <ul>
            <li><strong>See your data:</strong> Profile → <em>Download my data</em> gives you everything we hold about you.</li>
            <li><strong>Correct it:</strong> write to us at the address below and we&apos;ll fix wrong details.</li>
            <li><strong>Delete it, or take back your consent:</strong> Profile → <em>Delete my account</em>. This can&apos;t be undone.</li>
            <li><strong>Name someone to act for you</strong> if you can&apos;t (for example illness): tell us who.</li>
            <li><strong>Complain:</strong> write to us first; we reply within 30 days. If you&apos;re not satisfied, you can complain to the Data Protection Board of India.</li>
          </ul>

          <h2>Age</h2>
          <p>
            You need to be 18 or older to sign up. For anyone younger the law needs a parent&apos;s consent, which the
            app doesn&apos;t support yet: please talk to the library admins.
          </p>

          <h2>Contact</h2>
          <p>Privacy questions and requests: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>

          <h2>Changes</h2>
          <p>If this notice changes, the date at the top changes and the app asks you to agree again before you continue.</p>

          <p className="pv-back"><Link href="/">Back to {APP_NAME}</Link></p>
        </article>
      </main>
    </div>
  );
}
