"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/services/firebase";
import { useAuth } from "@/context/AuthContext";
import LandingPage from "./LandingPage";
import styles from "./AuthScreen.module.css";

const scenes = [
  { image: "/workspace_desk.png", alt: "Sunlit desk with an open notebook, books, and a small green plant", title: "Make a little room for yourself.", caption: "A quiet start", label: "01 / THE EVERYDAY PRACTICE" },
  { image: "/university_sketch.png", alt: "Architectural illustration of a university with books in the foreground", title: "Big ambitions. Small beginnings.", caption: "A bigger horizon", label: "02 / THE NEXT CHAPTER" },
];
const prompts = [
  "Explain one idea you know well—as if you were teaching a friend.",
  "What is one problem you solved recently? Start with the situation.",
  "Name a topic you find difficult. What part do you already understand?",
];

function Arrow() {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" /></svg>;
}
function BrandMark() {
  return <svg width="28" height="30" viewBox="0 0 30 32" fill="none" aria-hidden="true"><path d="M3 6 15 0l12 6v14l-12 7V14l12-8M3 6v20l12 6v-5M3 6l12 8" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>;
}
function GoogleMark() {
  return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/></svg>;
}
function Eye({ open }) {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{open && <path d="m3 3 18 18"/>}</svg>;
}
function friendlyError(error) {
  const messages = {
    "auth/invalid-credential": "That email and password don’t match. Please try again.",
    "auth/wrong-password": "That email and password don’t match. Please try again.",
    "auth/email-already-in-use": "This email already has an account. Try signing in instead.",
    "auth/weak-password": "Choose a password with at least 6 characters.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/too-many-requests": "Too many attempts. Please wait a little before trying again.",
    "auth/network-request-failed": "We couldn’t connect. Check your connection and try again.",
    "auth/popup-blocked": "Your browser blocked the sign-in window. Allow pop-ups for this site and try again.",
    "auth/operation-not-allowed": "This sign-in method is currently unavailable. You can continue as a guest.",
  };
  return messages[error?.code] || "We couldn’t complete that request. Please try again or continue as a guest.";
}

export default function AuthScreen({ onLoginSuccess }) {
  const { loginWithEmail, signupWithEmail, loginWithGoogle, isConfigured } = useAuth();
  const [screenMode, setScreenMode] = useState("landing");
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busyAction, setBusyAction] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [promptIndex, setPromptIndex] = useState(-1);
  const artwork = useRef(null);
  const busy = busyAction !== null;
  const isSignup = authMode === "signup";
  const isReset = authMode === "reset";
  const scene = scenes[sceneIndex];

  function switchMode(mode) {
    setAuthMode(mode);
    setErrorMessage("");
    setResetSuccess(false);
    setPassword("");
    setShowPassword(false);
  }
  function openAuth(mode) {
    switchMode(mode);
    setScreenMode("auth");
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function goHome() {
    setScreenMode("landing");
    setErrorMessage("");
    setPassword("");
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  async function handleSubmit(event) {
    event.preventDefault();
    if (busy || !isConfigured) return;
    setBusyAction(isReset ? "reset" : "email");
    setErrorMessage("");
    setResetSuccess(false);
    try {
      if (isReset) {
        await sendPasswordResetEmail(auth, email.trim());
        setResetSuccess(true);
      } else {
        if (isSignup) {
          if (!fullName.trim()) { setErrorMessage("Please enter your name."); return; }
          await signupWithEmail(email.trim(), password, fullName.trim());
        } else {
          await loginWithEmail(email.trim(), password);
        }
        onLoginSuccess?.();
      }
    } catch (error) {
      if (isReset && error.code === "auth/user-not-found") setResetSuccess(true);
      else setErrorMessage(friendlyError(error));
    } finally {
      setBusyAction(null);
    }
  }
  async function handleGoogleAuth() {
    if (busy || !isConfigured) return;
    setBusyAction("google");
    setErrorMessage("");
    try {
      await loginWithGoogle();
      onLoginSuccess?.();
    } catch (error) {
      if (!["auth/popup-closed-by-user", "auth/cancelled-popup-request"].includes(error.code)) setErrorMessage(friendlyError(error));
    } finally {
      setBusyAction(null);
    }
  }
  function tilt(event) {
    if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    artwork.current?.style.setProperty("--turn", `${(event.clientX - bounds.left - bounds.width / 2) / 100}deg`);
  }
  const guest = () => onLoginSuccess?.("Guest Candidate");
  if (screenMode === "landing") return <LandingPage onSignIn={() => openAuth("login")} onGetStarted={() => openAuth("signup")} onGuest={guest} />;

  return (
    <div className={styles.page}>
      <a href="#auth-form" className={styles.skip}>Skip to sign-in form</a>
      <nav className={styles.nav} aria-label="Account navigation">
        <button className={styles.brand} onClick={goHome} disabled={busy} aria-label="PrepSim home"><BrandMark />PrepSim<sup>AI</sup></button>
        <span className={styles.navNote}>THE CONFIDENCE ATLAS <i /> YOUR PERSONAL SPACE</span>
        <button className={styles.back} onClick={goHome} disabled={busy}><span>←</span> Back to the atlas</button>
      </nav>

      <main className={styles.layout}>
        <section className={styles.story} aria-labelledby="welcome-title">
          <div className={styles.eyebrow}><span /> A SMALL STEP TOWARDS YOUR NEXT CHAPTER</div>
          <h1 id="welcome-title">Come as you are.<br /><em>Leave a little readier.</em></h1>
          <p className={styles.intro}>A quiet space to find your words, test your ideas,<br className={styles.desktopBreak} /> and build the confidence to be yourself.</p>

          <div className={styles.artwork} ref={artwork} onPointerMove={tilt} onPointerLeave={() => artwork.current?.style.setProperty("--turn", "0deg")}>
            <div className={styles.orbit} aria-hidden="true" />
            <figure className={styles.postcard}>
              <div className={styles.photoFrame}>
                <Image key={scene.image} src={scene.image} alt={scene.alt} width={1024} height={1024} sizes="(max-width: 600px) 80vw, (max-width: 1000px) 45vw, 390px" className={styles.photo} loading="eager" />
                <span className={styles.imageLabel}>A SPACE FOR POSSIBILITY</span>
              </div>
              <figcaption aria-live="polite"><span>{scene.label}</span><strong>{scene.title}</strong></figcaption>
            </figure>
            <div className={styles.seal} aria-hidden="true"><span>YOUR OWN PACE</span><b>✳</b><span>YOUR OWN PATH</span></div>
            <div className={styles.note}><span>A NOTE TO SELF</span><p>You don’t have to<br />be perfect.<br /><em>Just begin.</em></p><span className={styles.noteLine} /></div>
          </div>

          <div className={styles.sceneSwitch} aria-label="Choose your welcome illustration">
            {scenes.map((item, index) => <button key={item.image} type="button" aria-pressed={sceneIndex === index} onClick={() => setSceneIndex(index)}><span>0{index + 1}</span>{item.caption}<i /></button>)}
          </div>
          <div className={styles.warmup}>
            <div className={styles.warmupTop}><span>✧ A LITTLE WARM-UP</span><button type="button" aria-controls="warmup-prompt" onClick={() => setPromptIndex((promptIndex + 1) % prompts.length)}>{promptIndex < 0 ? "Give it a try" : "Another prompt"}<Arrow /></button></div>
            <p id="warmup-prompt" aria-live="polite">{promptIndex < 0 ? "Before you step in, give your thoughts a little room." : prompts[promptIndex]}</p>
          </div>
        </section>

        <section className={styles.formSide} aria-labelledby="form-title">
          <div className={styles.formCard} id="auth-form">
            <div className={styles.cardLabel}><span>YOUR PRACTICE PASS</span><span>↗</span></div>
            {!isReset && <div className={styles.modeSwitch} aria-label="Account mode"><button type="button" aria-pressed={!isSignup} disabled={busy} onClick={() => switchMode("login")}>Sign in</button><button type="button" aria-pressed={isSignup} disabled={busy} onClick={() => switchMode("signup")}>Create account</button></div>}
            <h2 id="form-title">{isReset ? <>A fresh <em>start.</em></> : isSignup ? <>Your next <em>chapter.</em></> : <>Welcome <em>back.</em></>}</h2>
            <p className={styles.formIntro}>{isReset ? "Enter your email and we’ll help you reset your password." : isSignup ? "Make room for your progress. Start your PrepSim story." : "Your practice room is right where you left it."}</p>
            {!isConfigured && <p className={styles.notice} role="status">Account sign-in is unavailable right now. You can still explore with guest practice below.</p>}
            {errorMessage && <p className={styles.error} role="alert">{errorMessage}</p>}
            {resetSuccess && <div className={styles.success} role="status"><strong>Check your inbox.</strong><p>If an account matches that email, you’ll receive a reset link. Check your spam folder too.</p></div>}
            {!isReset && <><button type="button" className={styles.google} onClick={handleGoogleAuth} disabled={busy || !isConfigured}><GoogleMark />{busyAction === "google" ? "Connecting to Google…" : "Continue with Google"}<span>↗</span></button><div className={styles.divider}><span>or use your email</span></div></>}
            <form onSubmit={handleSubmit} aria-busy={busy}>
              <fieldset disabled={busy} className={styles.fields}>
                {isSignup && <div className={styles.field}><label htmlFor="auth-name">Full name</label><input id="auth-name" name="name" type="text" autoComplete="name" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="What should we call you?" required maxLength={100} /></div>}
                <div className={styles.field}><label htmlFor="auth-email">Email address</label><input id="auth-email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} value={email} onChange={e => { setEmail(e.target.value); setResetSuccess(false); }} placeholder="you@example.com" required /></div>
                {!isReset && <div className={styles.field}><div className={styles.labelRow}><label htmlFor="auth-password">Password</label>{!isSignup && <button type="button" onClick={() => switchMode("reset")}>Forgot password?</button>}</div><div className={styles.passwordWrap}><input id="auth-password" name="password" type={showPassword ? "text" : "password"} autoComplete={isSignup ? "new-password" : "current-password"} value={password} onChange={e => setPassword(e.target.value)} placeholder={isSignup ? "Create your password" : "Enter your password"} required minLength={isSignup ? 6 : undefined} aria-describedby={isSignup ? "password-hint" : undefined} /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}><Eye open={showPassword} /></button></div>{isSignup && <p className={styles.hint} id="password-hint">At least 6 characters. Make it something only you know.</p>}</div>}
                <button type="submit" className={styles.submit} disabled={busy || !isConfigured || (isReset && resetSuccess)}>{busyAction === "email" ? "Opening your space…" : busyAction === "reset" ? "Sending reset link…" : isReset ? "Send reset link" : isSignup ? "Create your space" : "Step back in"}{busy ? <span className={styles.spinner} aria-hidden="true" /> : <Arrow />}</button>
              </fieldset>
            </form>
            {isReset ? <button className={styles.returnLink} disabled={busy} onClick={() => switchMode("login")}>← Back to sign in</button> : <p className={styles.accountNote}>{isSignup ? "Already have a space here?" : "First time finding your voice?"} <button type="button" disabled={busy} onClick={() => switchMode(isSignup ? "login" : "signup")}>{isSignup ? "Sign in" : "Create an account"}</button></p>}
            <div className={styles.guestSection}><div><span>JUST LOOKING AROUND?</span><p>Start a little practice. No account needed.</p></div><button type="button" onClick={guest} disabled={busy}>Try as a guest <Arrow /></button></div>
          </div>
          <div className={styles.underCard}><span>◈</span> Your pace. Your progress. Your next chapter.</div>
        </section>
      </main>
      <footer className={styles.footer}><span>© {new Date().getFullYear()} PrepSim</span><p>Practice for the moments that matter.</p><span>THINK IT. SAY IT. BECOME IT.</span></footer>
    </div>
  );
}
