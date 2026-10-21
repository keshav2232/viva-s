import Link from "next/link";
import LegalPage, { SupportEmail } from "@/components/legal/LegalPage";
import styles from "@/components/legal/LegalPage.module.css";
import { SITE } from "@/config/site";

export const metadata = {
  title: `Privacy policy — ${SITE.name}`,
  description: `What ${SITE.name} collects when you practise, where your voice and answers go, how long they are kept, and how to delete them.`
};

const TOC = [
  ["summary", "In short"],
  ["collect", "What we collect"],
  ["voice", "Your voice and answers"],
  ["processors", "Services that process your data"],
  ["storage", "Where it is stored and for how long"],
  ["browser-storage", "Cookies and browser storage"],
  ["rights", "Your choices and rights"],
  ["children", "Children"],
  ["security", "Security"],
  ["changes", "Changes and contact"]
];

export default function PrivacyPage() {
  const who = SITE.operator || SITE.name;
  return (
    <LegalPage
      current="/privacy"
      eyebrow="LEGAL / PRIVACY"
      title="Privacy policy"
      intro={`How ${SITE.name} handles the things you share while you practise: your account details, the material you upload, and your spoken answers.`}
      toc={TOC}
    >
      <section id="summary" aria-labelledby="summary-h">
        <h2 id="summary-h">In short</h2>
        <ul>
          <li>Your spoken answers are turned into text and sent to <strong>Google Gemini</strong> so they can be graded. The examiner&apos;s lines are sent to <strong>ElevenLabs</strong> to be spoken aloud.</li>
          <li>We do <strong>not</strong> keep your audio recordings. A recording stays in your browser tab for replay and is gone when you close it.</li>
          <li>If you sign in, your practice history (transcripts, scores and feedback) is saved to your account. As a guest, it stays in this browser and is cleared on your next visit.</li>
          <li>You can delete a single session, your whole history, or your account at any time from the <strong>Your data</strong> section of the dashboard.</li>
          <li>We do not sell your data and we do not use advertising or tracking cookies.</li>
        </ul>
      </section>

      <section id="collect" aria-labelledby="collect-h">
        <h2 id="collect-h">What we collect</h2>
        <div className={styles.tableWrap}>
          <table>
            <thead><tr><th scope="col">Data</th><th scope="col">When</th><th scope="col">Why</th></tr></thead>
            <tbody>
              <tr><td>Name, email address, password (handled by Firebase; we never see your password)</td><td>When you create an account or sign in with Google</td><td>To give you an account and keep your history</td></tr>
              <tr><td>Topics, job roles, syllabus text, notes, job descriptions or résumés you paste or upload</td><td>When you set up a session</td><td>To write questions about what you want to practise</td></tr>
              <tr><td>Microphone audio and the text of your answers</td><td>During a session, only after you allow the microphone</td><td>To understand and grade your answers</td></tr>
              <tr><td>Scores, AI feedback, and delivery estimates (speaking pace, pauses, filler words)</td><td>After each answer</td><td>To show your results and progress</td></tr>
              <tr><td>IP address</td><td>With every request to our server</td><td>To limit abuse (rate limiting). Held in memory for about a minute, not stored</td></tr>
            </tbody>
          </table>
        </div>
        <p>PDF files are read <strong>inside your browser</strong>; only the extracted text is sent to us. Please do not upload documents that contain other people&apos;s personal information, and remove details you do not want processed (for example your phone number or address on a résumé).</p>
      </section>

      <section id="voice" aria-labelledby="voice-h">
        <h2 id="voice-h">Your voice and answers</h2>
        <h3>Speech to text</h3>
        <p>Your browser&apos;s built-in speech recognition turns what you say into text. In Google Chrome and Microsoft Edge this audio is sent to Google&apos;s or Microsoft&apos;s speech service by the browser itself, under their privacy terms. You can type your answers instead at any time.</p>
        <h3>Grading</h3>
        <p>For each answer we send the question, your answer text and, when available, the recording of that answer to Google&apos;s Gemini API, together with short notes about earlier answers in the session. Gemini returns a grade, feedback and the next question. Our server does not store the recording.</p>
        <h3>Delivery estimates</h3>
        <p>Figures such as confidence, nervousness or hesitation are <strong>rough estimates</strong> from your speaking pace, pauses, filler words and the recording. They are practice feedback, not a measurement of your emotions or health, and we do not use them to identify you.</p>
        <h3>The examiner&apos;s voice</h3>
        <p>The examiner&apos;s lines (for example &ldquo;Welcome, Asha. Let&apos;s begin…&rdquo;) are sent to ElevenLabs to be turned into speech. These lines can include the first name you entered. Your own voice is never sent to ElevenLabs.</p>
      </section>

      <section id="processors" aria-labelledby="processors-h">
        <h2 id="processors-h">Services that process your data</h2>
        <ul>
          <li><strong>Google Firebase</strong> (Authentication and Cloud Firestore): accounts and saved practice history.</li>
          <li><strong>Google Gemini API</strong>: grading answers, writing questions, hints, outlines from your material, flashcards and the session retrospective.
            {SITE.geminiPaidTier
              ? " We use Google's paid service, under which Google does not use this content to improve its products."
              : " We currently use Google's free tier. Under Google's terms for that tier, the content we send may be used to improve Google's products and may be reviewed by people. Do not include sensitive personal information in your answers or uploads."}
          </li>
          <li><strong>ElevenLabs</strong>: text to speech for the examiner&apos;s voice.</li>
          <li><strong>Your browser&apos;s speech service</strong>: speech to text, as described above.</li>
          <li><strong>{SITE.host || "Our hosting provider"}</strong>: runs the website and our server, and may keep short technical logs.</li>
        </ul>
        <p>Each of these providers handles data under its own privacy terms. Some of them process data outside your country, including in the United States.</p>
      </section>

      <section id="storage" aria-labelledby="storage-h">
        <h2 id="storage-h">Where it is stored and for how long</h2>
        <div className={styles.cards}>
          <div>
            <h3>Signed in</h3>
            <p>Your sessions, transcripts, scores, feedback and topic progress are stored in Cloud Firestore under your account until you delete them or delete your account. Deleting is immediate on our side.</p>
          </div>
          <div>
            <h3>Guest</h3>
            <p>Everything stays in this browser&apos;s local storage. It is cleared when you return in a new visit, when you sign out, or when you delete it from the dashboard.</p>
          </div>
        </div>
        <p>Audio recordings are not stored by us. Data sent to Google and ElevenLabs is kept according to their own policies. A paused session is saved only in this browser until you resume or discard it.</p>
      </section>

      <section id="browser-storage" aria-labelledby="browser-storage-h">
        <h2 id="browser-storage-h">Cookies and browser storage</h2>
        <p>We do not use advertising, analytics or tracking cookies. We use your browser&apos;s storage only for things the site needs to work: keeping you signed in (Firebase), guest practice history, a paused session, your study-plan ticks, and your topic progress.</p>
      </section>

      <section id="rights" aria-labelledby="rights-h">
        <h2 id="rights-h">Your choices and rights</h2>
        <ul>
          <li><strong>Delete</strong> a session, your whole history or your account yourself: dashboard → <strong>Your data</strong>.</li>
          <li><strong>Practise without an account</strong> as a guest, and <strong>type instead of speaking</strong>.</li>
          <li><strong>Ask for a copy</strong> of your data, a correction, or anything you cannot do yourself by contacting us at <SupportEmail subject="Privacy request" />.</li>
          <li>Depending on where you live, you may have further rights (for example under the GDPR or India&apos;s Digital Personal Data Protection Act), including the right to complain to your data protection authority.</li>
        </ul>
      </section>

      <section id="children" aria-labelledby="children-h">
        <h2 id="children-h">Children</h2>
        <p>{SITE.name} is meant for students and job seekers aged {SITE.minimumAge} or over. If you are under the age of adulthood where you live, use it only with your parent&apos;s or guardian&apos;s permission. If you believe a child has given us personal data without permission, contact us and we will delete it.</p>
      </section>

      <section id="security" aria-labelledby="security-h">
        <h2 id="security-h">Security</h2>
        <p>Data travels over encrypted connections (HTTPS). Saved history is protected by Firebase security rules so that only your signed-in account can read or change it. No system is perfectly secure, so please avoid sharing sensitive personal information in your answers or uploads.</p>
      </section>

      <section id="changes" aria-labelledby="changes-h">
        <h2 id="changes-h">Changes and contact</h2>
        <p>If we change this policy, we will update the date at the top of this page. For important changes we will also tell signed-in users by email or on the dashboard.</p>
        <p>This service is run by {who}. Questions or requests: <SupportEmail subject="Privacy question" />. See also our <Link href="/terms">terms of use</Link>.</p>
      </section>
    </LegalPage>
  );
}
