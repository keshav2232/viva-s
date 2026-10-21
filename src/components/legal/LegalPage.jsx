import Link from "next/link";
import { SITE, isLegalConfigured } from "@/config/site";
import styles from "./LegalPage.module.css";

function Mark() {
  return <svg width="26" height="28" viewBox="0 0 30 32" fill="none" aria-hidden="true"><path d="M3 6 15 0l12 6v14l-12 7V14l12-8M3 6v20l12 6v-5M3 6l12 8" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" /></svg>;
}

const LINKS = [["/privacy", "Privacy"], ["/terms", "Terms"], ["/contact", "Contact"]];

/** Top bar shared by the legal and contact pages. */
export function LegalNav({ current }) {
  return (
    <header className={styles.nav}>
      <Link className={styles.brand} href="/"><Mark />{SITE.name}</Link>
      <nav aria-label="Legal and support">
        {LINKS.map(([href, label]) => (
          <Link key={href} href={href} aria-current={current === href ? "page" : undefined}>{label}</Link>
        ))}
      </nav>
    </header>
  );
}

/** Footer shared by the legal and contact pages. */
export function LegalFooter() {
  return (
    <footer className={styles.footer}>
      <span>© {new Date().getFullYear()} {SITE.operator || SITE.name}</span>
      <nav aria-label="Footer">
        <Link href="/">Home</Link>
        {LINKS.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
      </nav>
    </footer>
  );
}

/** Shared shell for the privacy, terms and contact pages (server component, no JavaScript needed). */
export default function LegalPage({ eyebrow, title, intro, current, toc, children }) {
  const missing = !isLegalConfigured() && process.env.NODE_ENV !== "production";
  return (
    <div className={styles.page}>
      <a className={styles.skip} href="#legal-content">Skip to content</a>
      <LegalNav current={current} />

      <main className={styles.layout} id="legal-content" tabIndex={-1}>
        <div className={styles.head}>
          <span className={styles.eyebrow}>{eyebrow}</span>
          <h1>{title}</h1>
          {intro && <p className={styles.intro}>{intro}</p>}
          <p className={styles.updated}>Last updated: {SITE.policyUpdated}</p>
          {missing && (
            <p className={styles.devNote} role="note">
              Development notice: set NEXT_PUBLIC_LEGAL_OPERATOR, NEXT_PUBLIC_SUPPORT_EMAIL and NEXT_PUBLIC_LEGAL_JURISDICTION
              before launch. This notice is not shown in production.
            </p>
          )}
        </div>

        <div className={styles.body}>
          {toc && (
            <nav className={styles.toc} aria-label="On this page">
              <span>ON THIS PAGE</span>
              <ol>{toc.map(([id, label]) => <li key={id}><a href={`#${id}`}>{label}</a></li>)}</ol>
            </nav>
          )}
          <article className={styles.content}>{children}</article>
        </div>
      </main>

      <LegalFooter />
    </div>
  );
}

/** Support email as a link, or a neutral fallback when it has not been configured yet. */
export function SupportEmail({ subject }) {
  if (!SITE.supportEmail) return <span>the contact details on our <Link href="/contact">contact page</Link></span>;
  const href = `mailto:${SITE.supportEmail}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;
  return <a href={href}>{SITE.supportEmail}</a>;
}
