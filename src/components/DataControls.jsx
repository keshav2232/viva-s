"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "./DataControls.module.css";

/**
 * "Your data" panel on the dashboard: explains where practice data lives and lets the user delete
 * their history or account. Every destructive action needs a second, explicit confirmation.
 * Props are async handlers that throw on failure; this panel shows the outcome.
 */
export default function DataControls({ isSignedIn, sessionCount, hasPausedSession, onDeleteAllHistory, onDeleteAccount }) {
  const [confirming, setConfirming] = useState(null); // "history" | "account" | null
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [message, setMessage] = useState(null); // { tone: "ok" | "error", text }

  const cancel = () => { setConfirming(null); setPassword(""); setNeedsPassword(false); };

  async function run(kind) {
    setBusy(true);
    setMessage(null);
    try {
      if (kind === "history") {
        await onDeleteAllHistory();
        setMessage({ tone: "ok", text: "Your practice history has been deleted." });
      } else {
        await onDeleteAccount(password || undefined);
        setMessage({ tone: "ok", text: "Your account and all its data have been deleted." });
      }
      cancel();
    } catch (err) {
      if (err?.code === "needs-password") {
        setNeedsPassword(true);
        setMessage({ tone: "error", text: "For your security, enter your password to confirm." });
      } else if (err?.code === "auth/wrong-password" || err?.code === "auth/invalid-credential") {
        setNeedsPassword(true);
        setMessage({ tone: "error", text: "That password is not correct. Try again." });
      } else if (err?.code === "auth/popup-closed-by-user" || err?.code === "auth/cancelled-popup-request") {
        setMessage({ tone: "error", text: "Sign-in was cancelled, so nothing was deleted." });
      } else if (err?.code === "auth/requires-recent-login") {
        setMessage({ tone: "error", text: "Please sign out, sign in again, and then delete your account." });
      } else {
        console.error("Data deletion failed:", err);
        setMessage({ tone: "error", text: "Something went wrong and the deletion did not finish. Please try again, or contact support." });
      }
    } finally {
      setBusy(false);
    }
  }

  const nothingToDelete = sessionCount === 0 && !hasPausedSession;

  return (
    <section className={styles.panel} id="your-data" aria-labelledby="data-heading">
      <span className={styles.eyebrow}>04 / YOUR DATA</span>
      <h2 id="data-heading">Your data, your call.</h2>
      <div className={styles.grid}>
        <div className={styles.where}>
          <h3>Where it is kept</h3>
          {isSignedIn
            ? <p>Your {sessionCount} saved session{sessionCount === 1 ? "" : "s"} (transcripts, scores and feedback) are stored in your account. Audio recordings are never saved.</p>
            : <p>As a guest, your {sessionCount} session{sessionCount === 1 ? "" : "s"} live only in this browser and are cleared on your next visit. Audio recordings are never saved.</p>}
          <p>Answers are graded by Google Gemini and the examiner&apos;s voice comes from ElevenLabs. Read the <Link href="/privacy">privacy policy</Link> for details.</p>
          <p className={styles.hint}>To delete a single session, use the bin button next to it in your session journal.</p>
        </div>

        <div className={styles.actions}>
          <div className={styles.action}>
            <h3>Delete practice history</h3>
            <p>Removes every saved session, your scores, topic progress{hasPausedSession ? " and your paused session" : ""}.{isSignedIn ? " Your account stays." : ""}</p>
            {confirming === "history" ? (
              <div className={styles.confirm} role="group" aria-label="Confirm deleting practice history">
                <p><strong>Delete all practice history?</strong> This cannot be undone.</p>
                <div>
                  <button type="button" className={styles.danger} disabled={busy} onClick={() => run("history")}>{busy ? "Deleting…" : "Yes, delete history"}</button>
                  <button type="button" className={styles.secondary} disabled={busy} onClick={cancel}>Keep it</button>
                </div>
              </div>
            ) : (
              <button type="button" className={styles.secondary} disabled={nothingToDelete || busy} onClick={() => { setMessage(null); setConfirming("history"); }}>
                {nothingToDelete ? "Nothing to delete" : "Delete history…"}
              </button>
            )}
          </div>

          {isSignedIn && (
            <div className={styles.action}>
              <h3>Delete account</h3>
              <p>Permanently deletes your account, sign-in and everything saved with it.</p>
              {confirming === "account" ? (
                <div className={styles.confirm} role="group" aria-label="Confirm deleting account">
                  <p><strong>Delete your account permanently?</strong> All sessions and progress will be lost. This cannot be undone.</p>
                  {needsPassword && (
                    <label className={styles.password}>
                      <span>Password</span>
                      <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                    </label>
                  )}
                  <div>
                    <button type="button" className={styles.danger} disabled={busy || (needsPassword && !password)} onClick={() => run("account")}>{busy ? "Deleting…" : "Yes, delete my account"}</button>
                    <button type="button" className={styles.secondary} disabled={busy} onClick={cancel}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button type="button" className={styles.dangerOutline} disabled={busy} onClick={() => { setMessage(null); setConfirming("account"); }}>Delete account…</button>
              )}
            </div>
          )}
        </div>
      </div>
      <p className={message?.tone === "error" ? styles.error : styles.ok} role="status" aria-live="polite">{message?.text || ""}</p>
    </section>
  );
}
