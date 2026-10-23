"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./PrivacyMobileNav.module.css";

function Icon({ name }) {
  const paths = {
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></>,
    contact: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></>,
    chevron: <path d="m8 10 4 4 4-4" />,
  };
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export default function PrivacyMobileNav({ name, logo, current, title, sections }) {
  const pageIcon = current === "/privacy" ? "lock" : current === "/terms" ? "info" : "contact";
  const dialog = useRef(null);
  const trigger = useRef(null);
  const previousOverflow = useRef(null);
  const [query, setQuery] = useState("");
  const matches = sections.filter(([, label]) => label.toLowerCase().includes(query.trim().toLowerCase()));

  function restoreScroll() {
    if (previousOverflow.current !== null) {
      document.documentElement.style.overflow = previousOverflow.current;
      previousOverflow.current = null;
    }
  }

  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 820px)");
    const element = dialog.current;
    function resize() { if (!mobile.matches) element?.close(); }
    mobile.addEventListener("change", resize);
    return () => { mobile.removeEventListener("change", resize); restoreScroll(); };
  }, []);

  function openMenu() {
    setQuery("");
    previousOverflow.current = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    dialog.current.showModal();
  }

  function goToSection(id) {
    dialog.current.close();
    const section = document.getElementById(id);
    section?.setAttribute("tabindex", "-1");
    section?.focus({ preventScroll: true });
  }

  return <>
    <header className={styles.header}>
      <Link href="/" className={styles.brand}>{logo}<span>{name}</span></Link>
      <button ref={trigger} type="button" className={styles.iconButton} onClick={openMenu} aria-label="Open page navigation" aria-haspopup="dialog" aria-controls="legal-mobile-navigation"><Icon name="menu" /></button>
    </header>
    <dialog ref={dialog} id="legal-mobile-navigation" className={styles.dialog} aria-labelledby="legal-navigation-title" onClose={restoreScroll} onClick={event => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.current.close();
    }}>
      <div className={styles.dialogHeader}>
        <h2 id="legal-navigation-title">{title}</h2>
        <button type="button" className={styles.iconButton} onClick={() => dialog.current.close()} aria-label="Close page navigation"><Icon name="close" /></button>
      </div>
      <nav aria-label="Mobile legal navigation" className={styles.links}>
        <Link href="/" className={styles.row} onClick={() => dialog.current.close()}><Icon name="home" /><span>{name} home</span></Link>
        <label className={styles.search}><Icon name="search" /><input type="search" aria-label="Search page sections" placeholder="Search this page" value={query} onChange={event => setQuery(event.target.value)} /></label>
        {query.trim() ? <div className={styles.sectionLinks}>
          <p className={styles.searchStatus} role="status">{matches.length ? `${matches.length} matching sections` : "No sections found. Try another word."}</p>
          {matches.map(([id, label]) => <a key={id} href={`#${id}`} onClick={() => goToSection(id)}>{label}</a>)}
        </div> : <details className={styles.group}>
          <summary className={styles.row}><Icon name={pageIcon} /><span>{title}</span><span className={styles.chevron}><Icon name="chevron" /></span></summary>
          <div className={styles.sectionLinks}>{sections.map(([id, label]) => <a key={id} href={`#${id}`} onClick={() => goToSection(id)}>{label}</a>)}</div>
        </details>}
        {[["/privacy", "Privacy policy", "lock"], ["/terms", "Terms of use", "info"], ["/contact", "Contact and support", "contact"]]
          .filter(([href]) => href !== current)
          .map(([href, label, icon]) => <Link key={href} href={href} className={styles.row} onClick={() => dialog.current.close()}><Icon name={icon} /><span>{label}</span></Link>)}
      </nav>
    </dialog>
  </>;
}
