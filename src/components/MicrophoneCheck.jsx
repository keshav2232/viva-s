"use client";
import { useEffect, useRef, useState } from "react";
import styles from "./MicrophoneCheck.module.css";
import Brand from "./Brand";

export default function MicrophoneCheck({ config, examiner, onBack, onReady }) {
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [level, setLevel] = useState(0);
  const resources = useRef({});
  const mounted = useRef(true);
  function release() {
    const current = resources.current;
    cancelAnimationFrame(current.frame);
    current.stream?.getTracks().forEach(track => track.stop());
    current.context?.close().catch(() => {});
    resources.current = {};
  }
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; release(); };
  }, []);
  async function enableMicrophone() {
    if (status === "requesting") return;
    release();
    setStatus("requesting");
    setMessage("");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) { stream.getTracks().forEach(track => track.stop()); return; }
      resources.current.stream = stream;
      stream.getAudioTracks().forEach(track => { track.onended = () => { if (mounted.current) { release(); setStatus("error"); setMessage("Microphone access ended. Enable it again to continue."); } }; });
      setStatus("ready");
      setMessage("Microphone connected. Say a few words to check the level below.");
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const context = new AudioContext();
        resources.current.context = context;
        await context.resume();
        if (!mounted.current) return;
        const analyser = context.createAnalyser();
        analyser.fftSize = 256;
        context.createMediaStreamSource(stream).connect(analyser);
        const samples = new Uint8Array(analyser.fftSize);
        function tick() {
          if (resources.current.stream !== stream) return;
          analyser.getByteTimeDomainData(samples);
          const rms = Math.sqrt(samples.reduce((sum, sample) => sum + ((sample - 128) / 128) ** 2, 0) / samples.length);
          setLevel(Math.min(100, Math.round(rms * 400)));
          resources.current.frame = requestAnimationFrame(tick);
        }
        tick();
      } catch { setMessage("Microphone connected. Live level display is unavailable in this browser."); }
    } catch (error) {
      if (!mounted.current) return;
      setStatus("error");
      setMessage(error.name === "NotAllowedError" ? "Microphone access was blocked. Open the site controls beside the address bar, allow Microphone, then try again." : error.name === "NotFoundError" ? "No microphone was found. Connect one, then try again." : error.message === "unsupported" ? "Microphone access is unavailable. Open this page in a browser that supports microphone access over HTTPS or localhost." : "We couldn’t connect to your microphone. Check your device and close other apps using it, then try again.");
    }
  }
  return <section className={styles.screen} aria-labelledby="mic-title">
    <nav className={styles.nav}><Brand /><button onClick={() => { release(); onBack(); }}>← Back to setup</button></nav>
    {status === "requesting" && <aside className={styles.guide} role="status"><svg viewBox="0 0 100 90" aria-hidden="true"><path d="M85 80Q20 80 20 10M7 24 20 10 34 24" /></svg><strong>Choose “Allow” in your browser</strong><p>Look near the address bar for the microphone prompt. On mobile, it may appear at the bottom of the screen.</p></aside>}
    <div className={styles.card}>
      <div className={styles.intro}><span className={styles.eyebrow}>ONE LAST CHECK / BEFORE YOU BEGIN</span><div className={styles.mic} aria-hidden="true"><svg viewBox="0 0 64 80"><rect x="20" y="4" width="24" height="43" rx="12"/><path d="M10 32v6a22 22 0 0 0 44 0v-6M32 60v14M20 75h24M25 17h14M25 25h14"/></svg></div><h1>Make room for<br/><em>your voice.</em></h1><p>A quick microphone check, then you’re ready to practise.</p><dl><div><dt>YOUR TOPIC</dt><dd>{config.topic}</dd></div><div><dt>YOUR SESSION</dt><dd>{config.duration} minutes · {examiner}</dd></div></dl></div>
      <div className={styles.controls}><span className={styles.eyebrow}>MICROPHONE CHECK</span><h2>Let’s get you connected.</h2><ol><li><span>1</span><div><strong>Enable your microphone</strong><p>We’ll ask your browser for access here.</p></div></li><li><span>2</span><div><strong>Select “Allow”</strong><p>Approve the browser prompt to use your voice.</p></div></li><li><span>3</span><div><strong>Say a few words</strong><p>Watch the level move, then start your session.</p></div></li></ol>
      <div className={styles.status} role="status" aria-live="polite">{message || (status === "requesting" ? "Waiting for your browser’s microphone permission…" : "Your session won’t start until you’re ready.")}</div>
      {status === "ready" && <div className={styles.meter}><span>Live microphone level</span><meter min="0" max="100" value={level} aria-label="Live microphone level"/><small>This check displays your audio level; it does not save a recording.</small></div>}
      {status !== "ready" ? <button className={styles.primary} onClick={enableMicrophone} disabled={status === "requesting"}>{status === "requesting" ? "Waiting for permission…" : status === "error" ? "Try microphone again ↗" : "Enable microphone ↗"}</button> : <button className={styles.primary} onClick={() => { release(); onReady(); }}>{config.isResume ? "Resume session" : "Start session"} →</button>}
      <p className={styles.footnote}>You’re in control. You can return to setup at any time before starting.</p></div>
    </div>
  </section>;
}
