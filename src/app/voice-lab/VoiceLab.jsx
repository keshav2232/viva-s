"use client";

import { useRef, useState } from "react";
import styles from "./voiceLab.module.css";
import { GEMINI_VOICES, PROFESSORS, SAMPLE_LINES } from "./voices";

// Development playground: hear each examiner persona through Gemini TTS before wiring it into the viva.
export default function VoiceLab() {
  const [line, setLine] = useState(SAMPLE_LINES[0].text);
  const [profs, setProfs] = useState(PROFESSORS.map((p) => ({ ...p })));
  const [busy, setBusy] = useState({});
  const [takes, setTakes] = useState({}); // id -> [{ url, voice, line, ms, cached }]
  const [status, setStatus] = useState("");
  const players = useRef({});

  const update = (id, patch) => setProfs((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  async function generate(prof) {
    setBusy((b) => ({ ...b, [prof.id]: true }));
    setStatus(`Generating ${prof.title}…`);
    try {
      const res = await fetch("/api/voice-lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: line, voice: prof.voice, style: prof.style })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Request failed (${res.status})`);
      }
      const ms = Number(res.headers.get("X-TTS-Ms"));
      const cached = res.headers.get("X-TTS-Cached") === "1";
      const url = URL.createObjectURL(await res.blob());
      setTakes((t) => ({ ...t, [prof.id]: [{ url, voice: prof.voice, line, ms, cached }, ...(t[prof.id] || [])].slice(0, 5) }));
      setStatus(`${prof.title} ready${cached ? " (from cache)" : ` in ${(ms / 1000).toFixed(1)} s`}. Playing now.`);
      setTimeout(() => players.current[prof.id]?.play().catch(() => {}), 50);
    } catch (e) {
      setStatus(`${prof.title}: ${e.message}`);
    } finally {
      setBusy((b) => ({ ...b, [prof.id]: false }));
    }
  }

  return (
    <main className={styles.lab}>
      <div className={styles.head}>
        <span className={styles.eyebrow}>DEVELOPMENT TOOL / VOICE LAB</span>
        <h1>Hear your <em>four examiners.</em></h1>
        <p>
          Each card sends the line below to Gemini TTS with its own voice and acting direction. Change either and
          generate again to compare. The free tier allows only a few clips per minute, and each clip takes a few
          seconds to generate. Identical requests are replayed from cache without using quota.
        </p>
      </div>

      <section className={styles.lineBox} aria-labelledby="line-title">
        <h2 id="line-title">What should they say?</h2>
        <div className={styles.chips} role="group" aria-label="Sample lines">
          {SAMPLE_LINES.map((s) => (
            <button key={s.label} type="button" aria-pressed={line === s.text} onClick={() => setLine(s.text)}>{s.label}</button>
          ))}
        </div>
        <label htmlFor="line" className={styles.label}>Line to speak</label>
        <textarea id="line" value={line} maxLength={500} rows={3} onChange={(e) => setLine(e.target.value)} />
      </section>

      <p className={styles.status} role="status" aria-live="polite">{status}</p>

      <div className={styles.grid}>
        {profs.map((p) => {
          const def = PROFESSORS.find((d) => d.id === p.id);
          const list = takes[p.id] || [];
          return (
            <section key={p.id} className={styles.card} aria-labelledby={`${p.id}-title`}>
              <h2 id={`${p.id}-title`}>{p.title}</h2>

              <label htmlFor={`${p.id}-voice`} className={styles.label}>Voice</label>
              <select id={`${p.id}-voice`} value={p.voice} onChange={(e) => update(p.id, { voice: e.target.value })}>
                {GEMINI_VOICES.map((v) => <option key={v.name} value={v.name}>{v.name} ({v.tone})</option>)}
              </select>

              <label htmlFor={`${p.id}-style`} className={styles.label}>Acting direction</label>
              <textarea id={`${p.id}-style`} rows={4} maxLength={400} value={p.style} onChange={(e) => update(p.id, { style: e.target.value })} />

              <div className={styles.actions}>
                <button type="button" className={styles.primary} disabled={busy[p.id] || !line.trim()} onClick={() => generate(p)}>
                  {busy[p.id] ? "Generating…" : "Generate and play"}
                </button>
                {(p.voice !== def.voice || p.style !== def.style) && (
                  <button type="button" className={styles.ghost} onClick={() => update(p.id, { voice: def.voice, style: def.style })}>Reset</button>
                )}
              </div>

              {list.length > 0 && (
                <ol className={styles.takes} aria-label={`${p.title} takes, newest first`}>
                  {list.map((t, i) => (
                    <li key={t.url}>
                      <span>{t.voice} · {t.cached ? "cached" : `${(t.ms / 1000).toFixed(1)} s`} · “{t.line.slice(0, 48)}{t.line.length > 48 ? "…" : ""}”</span>
                      <audio controls src={t.url} ref={i === 0 ? (el) => { players.current[p.id] = el; } : undefined} />
                    </li>
                  ))}
                </ol>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
