import Link from "next/link";
import { LegalNav, LegalFooter } from "@/components/legal/LegalPage";
import legal from "@/components/legal/LegalPage.module.css";
import { FOUNDERS, SITE } from "@/config/site";
import FounderCard from "./FounderCard";
import styles from "./contact.module.css";

export const metadata = {
  title: `Contact the founders — ${SITE.name}`,
  description: `Talk to the two people who build ${SITE.name}: questions, bug reports, privacy requests or feedback on the examiner.`
};

const STEPS = [
  ["What you were doing", "For example “answering question 3 of a 10-minute viva”."],
  ["What went wrong", "What you expected, and what happened instead."],
  ["Where it happened", "Your browser and device, the time, and a screenshot if you can."]
];

const QUESTIONS = [
  ["The microphone does not work", "Click the lock or site-settings icon beside the address bar, allow Microphone, and reload. Voice answers work best in Chrome or Edge; anywhere else you can type your answers."],
  ["My history disappeared", "Guest history lives only in your browser and is cleared on your next visit. Sign in before practising to keep your sessions."],
  ["How do I delete my data?", "Open the dashboard and scroll to “Your data”. You can delete one session, your whole history or your account, and it takes effect immediately."],
  ["A grade looks wrong", "Grades are written by AI and can be mistaken. Send us the topic, the question and your answer so we can improve the grading."]
];

export default function ContactPage() {
  return (
    <div className={`${legal.page} ${styles.page}`}>
      <a className={legal.skip} href="#contact-content">Skip to content</a>
      <LegalNav current="/contact" />

      <main className={styles.main} id="contact-content" tabIndex={-1}>
        <section className={styles.hero} aria-labelledby="contact-title">
          <span className={styles.ghost} aria-hidden="true">hello</span>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}><i aria-hidden="true" /> SUPPORT / CONTACT &middot; TWO FOUNDERS</span>
            <h1 id="contact-title">Two founders.<br /><em>One hello</em> away.</h1>
            <p>
              {SITE.name} is built by two people, not a ticket queue. Questions, bugs, privacy requests or a thought about
              your examiner: write to either of us and it lands with the people who build it.
            </p>
            <a className={styles.jump} href="#founders">Meet the founders <span aria-hidden="true">↓</span></a>
          </div>

          <div className={styles.stage} aria-hidden="true">
            <svg className={styles.ring} viewBox="0 0 300 300">
              <defs><path id="contact-ring" d="M150 150m-118 0a118 118 0 1 1 236 0a118 118 0 1 1-236 0" /></defs>
              <text><textPath href="#contact-ring" textLength="738" lengthAdjust="spacing">WRITE TO US · WE READ EVERY MESSAGE · WRITE TO US · WE READ EVERY MESSAGE ·</textPath></text>
            </svg>
            <div className={`${styles.seal} ${styles.sealOne}`}><span>{FOUNDERS[0]?.initials}</span></div>
            <div className={`${styles.seal} ${styles.sealTwo}`}><span>{FOUNDERS[1]?.initials}</span></div>
            <span className={styles.plus}>+</span>
            <span className={styles.stamp}>PREPSIM<br />PRACTICE ROOM</span>
          </div>
        </section>

        <section className={styles.founders} id="founders" aria-label="The founders">
          {FOUNDERS.map((f, i) => <FounderCard key={f.email} founder={f} index={i} />)}
        </section>

        <section className={styles.report} aria-labelledby="report-title">
          <div className={styles.reportHead}>
            <span className={styles.eyebrow}>BEFORE YOU WRITE</span>
            <h2 id="report-title">Found a bug? <em>Three details</em> help us fix it fast.</h2>
          </div>
          <ol className={styles.steps}>
            {STEPS.map(([title, text], i) => (
              <li key={title}>
                <span className={styles.stepNum} aria-hidden="true">0{i + 1}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
          <p className={styles.note}>Please don&apos;t send passwords or recordings by email.</p>
        </section>

        <section className={styles.faq} aria-labelledby="faq-title">
          <div>
            <span className={styles.eyebrow}>QUICK ANSWERS</span>
            <h2 id="faq-title">Maybe you <em>don&apos;t</em> need to write.</h2>
            <p>The questions we hear most, answered in a line or two.</p>
          </div>
          <div className={styles.faqList}>
            {QUESTIONS.map(([q, a], i) => (
              <details key={q}>
                <summary><span className={styles.faqNum} aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>{q}<span className={styles.faqPlus} aria-hidden="true">+</span></summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className={styles.privacy} aria-labelledby="privacy-title">
          <h2 id="privacy-title">Privacy requests</h2>
          <p>
            For a copy of your data, a correction, or anything the dashboard can&apos;t do, email either founder from the
            address on your account. Read how we handle data in our <Link href="/privacy">privacy policy</Link>.
          </p>
        </section>
      </main>

      <LegalFooter />
    </div>
  );
}
