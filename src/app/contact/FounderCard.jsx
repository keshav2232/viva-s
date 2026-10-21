"use client";

import { useState } from "react";
import styles from "./contact.module.css";

function MailIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 6.5 8.5 7 8.5-7" /></svg>;
}
function CopyIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></svg>;
}
function LinkedInIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.5h4V21H3V9.5Zm7 0h3.8v1.6h.06c.53-1 1.84-2.06 3.8-2.06 4.06 0 4.8 2.67 4.8 6.15V21h-4v-5.1c0-1.22-.02-2.78-1.7-2.78-1.7 0-1.96 1.33-1.96 2.7V21h-4V9.5Z" /></svg>;
}

/** One founder "ticket": monogram, name, email (with copy) and LinkedIn. */
export default function FounderCard({ founder, index }) {
  const [copied, setCopied] = useState(false);
  const [first, ...rest] = founder.name.split(" ");

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(founder.email);
    } catch {
      // Older browsers / blocked clipboard: select a temporary field and copy from it.
      const field = document.createElement("textarea");
      field.value = founder.email;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      try { document.execCommand("copy"); } catch { /* ignore */ }
      field.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  const tone = index % 2 === 0 ? styles.rust : styles.sage;
  return (
    <article className={`${styles.ticket} ${tone}`} aria-labelledby={`founder-${index}`}>
      <div className={styles.ticketTop}>
        <div className={styles.ticketMeta}>
          <span>FOUNDER {String(index + 1).padStart(2, "0")}</span>
          <span aria-hidden="true">✳</span>
        </div>
        <div className={styles.identity}>
          <div className={styles.monogram} aria-hidden="true"><span>{founder.initials}</span></div>
          <div>
            <h2 id={`founder-${index}`}>{first} <em>{rest.join(" ")}</em></h2>
            <p>Co-founder, PrepSim</p>
          </div>
        </div>
      </div>

      <div className={styles.perforation} aria-hidden="true" />

      <div className={styles.ticketStub}>
        <div className={styles.emailRow}>
          <a className={styles.email} href={`mailto:${founder.email}?subject=${encodeURIComponent("Hello from PrepSim")}`}>
            <MailIcon /><span>{founder.email}</span>
          </a>
          <button type="button" className={styles.copy} onClick={copyEmail} aria-label={`Copy ${founder.name}'s email address`}>
            <CopyIcon /><span>{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>
        <a className={styles.linkedin} href={founder.linkedin} target="_blank" rel="noopener noreferrer">
          <LinkedInIcon /><span>Connect on LinkedIn</span><span className={styles.sr}> (opens in a new tab)</span><span aria-hidden="true" className={styles.arrow}>↗</span>
        </a>
        <p className={styles.sr} role="status" aria-live="polite">{copied ? `${founder.name}'s email address copied.` : ""}</p>
      </div>
    </article>
  );
}
