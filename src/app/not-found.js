import Link from "next/link";
import { LegalNav, LegalFooter } from "@/components/legal/LegalPage";
import legal from "@/components/legal/LegalPage.module.css";
import styles from "./not-found.module.css";

export const metadata = { title: "Page not found — PrepSim", robots: { index: false } };

/** Shown for any address that does not exist (and for notFound() calls). */
export default function NotFound() {
  return (
    <div className={legal.page}>
      {/* Rendered here (not only via metadata) so the tab title survives hydration. */}
      <title>Page not found — PrepSim</title>
      <LegalNav />
      <main className={styles.main} id="main-content">
        <span className={styles.code} aria-hidden="true">404</span>
        <span className={styles.eyebrow}>PAGE NOT FOUND</span>
        <h1>This room is <em>empty.</em></h1>
        <p>The page you were looking for doesn&apos;t exist, or it has moved. Your practice history is safe.</p>
        <div className={styles.actions}>
          <Link className={styles.primary} href="/dashboard">Go to your dashboard <span aria-hidden="true">→</span></Link>
          <Link className={styles.secondary} href="/">Back to the home page</Link>
        </div>
        <p className={styles.help}>Followed a broken link? <Link href="/contact">Tell us</Link> and we&apos;ll fix it.</p>
      </main>
      <LegalFooter />
    </div>
  );
}
