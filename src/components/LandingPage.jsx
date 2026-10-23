"use client";

import { useEffect, useRef, useState } from "react";
import useSectionNavigation from "./useSectionNavigation";
import styles from "./LandingPage.module.css";
import LegalLinks from "@/components/legal/LegalLinks";
import Brand from "./Brand";

function Arrow({ diagonal = false }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d={diagonal ? "M6 18 18 6M6 6h12v12" : "M4 12h15m-6-6 6 6-6 6"} /></svg>;
}

function Mic() {
  return <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><rect x="8" y="2" width="8" height="13" rx="4" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8" /></svg>;
}

const examples = {
  academic: { label: "ACADEMIC VIVA", topic: "Data structures", question: "You know how a hash table works. But what happens when two keys collide?", response: "I would use separate chaining, where each bucket stores a collection of entries…", focus: "Explain the trade-off between chaining and open addressing.", chips: ["Engineering", "Computer science", "Your syllabus"] },
  interview: { label: "MOCK INTERVIEW", topic: "System design", question: "Your product just reached a million users. What would you change about its architecture?", response: "First, I would identify the bottleneck using latency and traffic measurements…", focus: "Connect your architecture choices to a measurable constraint.", chips: ["Software engineering", "Product management", "Your job description"] },
};

const faqs = [
  ["What can I practise with PrepSim?", "Prepare for an academic viva using a topic or syllabus, or rehearse a job interview using a role or job description. You can adjust the session length and examiner style before you begin."],
  ["Do I need a microphone?", "A microphone gives you spoken practice, but you can also type your answers. Voice availability depends on your browser and microphone permissions."],
  ["Can I use my own study material?", "Yes. Upload your syllabus or job description, paste your notes, or start with a topic. You can review the generated topic outline before starting your session."],
  ["How should I use the feedback?", "Use AI feedback as a guide for revision, not an official grade. Review the question-level feedback, check important facts against your course material, and practise the areas you want to improve."],
  ["Can I try it without an account?", "Yes. Choose guest practice to explore the app. Guest history is temporary; sign in if you want to keep your practice history across visits."],
];

export default function LandingPage({ onSignIn, onGetStarted, onGuest }) {
  const [mode, setMode] = useState("academic");
  const [showAnswer, setShowAnswer] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef(null);
  const activeSection = useSectionNavigation("how-it-works,experience,questions");
  useEffect(() => {
    if (!menuOpen) return;
    function dismiss(event) {
      if (event.type === "keydown") {
        if (event.key !== "Escape") return;
        menuButton.current?.focus();
      } else if (event.target.closest("#landing-mobile-menu") || menuButton.current?.contains(event.target)) return;
      setMenuOpen(false);
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", dismiss);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", dismiss); };
  }, [menuOpen]);
  const scene = useRef(null);
  const example = examples[mode];

  function tilt(event) {
    if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const box = event.currentTarget.getBoundingClientRect();
    scene.current?.style.setProperty("--tilt-x", `${(event.clientY - box.top - box.height / 2) / -65}deg`);
    scene.current?.style.setProperty("--tilt-y", `${(event.clientX - box.left - box.width / 2) / 65}deg`);
  }

  function resetTilt() {
    scene.current?.style.setProperty("--tilt-x", "0deg");
    scene.current?.style.setProperty("--tilt-y", "0deg");
  }

  return (
    <div className={styles.page} id="top">
      <a className={styles.skip} href="#landing-main">Skip to content</a>
      <div className={styles.darkIntro}>
        <nav className={styles.nav} aria-label="Main navigation">
          <Brand as="a" href="#top" aria-label="PrepSim AI home" />
          <div className={styles.navLinks}>{[["experience", "The experience"], ["how-it-works", "How it works"], ["questions", "FAQs"]].map(([id, label]) => <a key={id} href={`#${id}`} aria-current={activeSection === id ? "location" : undefined}>{label}</a>)}</div>
          <div className={styles.navActions}><button className={styles.signIn} onClick={onSignIn}>Log in</button><button className={styles.navCta} onClick={onGetStarted}>Start practising <Arrow diagonal /></button><button ref={menuButton} className={styles.menuButton} aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} aria-controls="landing-mobile-menu" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? "Close" : "Menu"}</button></div>
        </nav>
        {menuOpen && <div className={styles.mobileMenu} id="landing-mobile-menu">{[["experience", "The experience"], ["how-it-works", "How it works"], ["questions", "FAQs"]].map(([id, label]) => <a key={id} href={`#${id}`} aria-current={activeSection === id ? "location" : undefined} onClick={() => { setMenuOpen(false); document.getElementById(id)?.focus({ preventScroll: true }); }}>{label}</a>)}<button onClick={() => { setMenuOpen(false); onSignIn(); }}>Log in <Arrow /></button></div>}

        <main id="landing-main">
          <div className={styles.atlasRail} aria-hidden="true"><span>THE CONFIDENCE ATLAS</span><i /><span>EST. FOR YOUR NEXT CHAPTER</span><b>↓</b></div>
          <section className={styles.hero} aria-labelledby="hero-title">
            <div className={styles.heroCopy}>
              <div className={styles.eyebrow}><span className={styles.statusDot} /> THE CONFIDENCE ATLAS / VOLUME 01</div>
              <h1 id="hero-title">A space to<br />become <span className={styles.serif}>ready.</span></h1>
              <p className={styles.heroDescription}>Turn what you know into answers that land. Practise vivas and interviews with an AI examiner—before the real room.</p>
              <div className={styles.heroActions}><button className={styles.primary} onClick={onGuest}>Enter your practice room <Arrow diagonal /></button><a className={styles.textLink} href="#experience"><span className={styles.playIcon}>▷</span> Explore a session</a></div>
              <div className={styles.heroNote}><span>✓ No account needed to try</span><span>✓ Your topic. Your pace.</span></div>
              <div className={styles.heroIndex}><span>LESS PERFORMANCE.<br />MORE POSSIBILITY.</span><a href="#how-it-works" aria-label="Scroll to how it works">FIND YOUR WAY <span>↓</span></a></div>
            </div>

            <div className={styles.sceneArea} onPointerMove={tilt} onPointerLeave={resetTilt}>
              <div className={styles.sceneGrid} aria-hidden="true" />
              <div className={styles.scene} ref={scene} aria-hidden="true">
                <div className={styles.orbitLabel}>FIG. 01 — YOUR VOICE, IN MOTION</div>
                <div className={styles.orbit}><div className={styles.orbitInner} /><div className={styles.orbitBolt} /></div>
                <div className={styles.orbitBack} />
                <div className={styles.sphere}><div className={styles.sphereRim} /><Mic /><span>YOUR NEXT CHAPTER</span></div>
                <div className={styles.satellite}><span>✦</span></div>
                <div className={styles.floatingLabel}><span className={styles.statusDot} /> READY WHEN YOU ARE</div>
                <div className={styles.sessionCard}>
                  <div className={styles.sessionTop}><span><span className={styles.tinyMark}>P</span> Practice room</span><span className={styles.liveTag}>DEMO</span></div>
                  <div className={styles.sessionBody}><div className={styles.voiceIcon}><Mic /></div><div><span className={styles.sessionCaption}>YOUR AI EXAMINER</span><p>“Let’s start with what you know.”</p></div></div>
                  <div className={styles.wave}>{Array.from({ length: 42 }, (_, i) => <i key={i} style={{ "--bar-height": `${9 + ((i * 17 + 7) % 31)}px`, "--bar-delay": `${i * -0.13}s` }} />)}</div>
                  <div className={styles.sessionBottom}><span>Think it through. Say it out loud.</span><span>↗</span></div>
                </div>
                <div className={styles.orbitFootnote}>A SMALL REHEARSAL FOR A BIG MOMENT.</div>
              </div>
            </div>
            <div className={styles.practicePass} aria-hidden="true"><div><span>YOUR PRACTICE PASS</span><span>↗</span></div><strong>Admit one.<br /><em>Future you.</em></strong><div className={styles.passBottom}><span>VIVAS + INTERVIEWS<br />NO AUDIENCE REQUIRED</span><span className={styles.barcode} aria-hidden="true" /></div></div>
          </section>
          <div className={styles.disciplineStrip}><span>BUILT FOR YOUR NEXT STEP</span><div>University vivas <span>✳</span> Technical interviews <span>✳</span> Career conversations <span>✳</span> Everyday confidence</div></div>

          <section className={styles.process} id="how-it-works" aria-labelledby="process-title">
            <div className={styles.sectionTop}><span className={styles.eyebrow}>01 / FOLLOW YOUR OWN TRAJECTORY</span><span className={styles.smallTag}>THREE STOPS. ONE STEP FORWARD.</span></div>
            <div className={styles.processHeading}><h2 id="process-title">Confidence isn’t a gift.<br />It’s <em>repetition.</em></h2><p>You’ve done the reading. Now give your knowledge a voice. A focused practice loop takes you from “I think I know” to “let me explain.”</p></div>
            <div className={styles.steps}>
              <article className={styles.step}><div className={styles.stepVisual} aria-hidden="true"><div className={styles.paperBack} /><div className={styles.paper}><span>YOUR STARTING POINT</span><strong>A little context.<br />A lot of possibility.</strong><i /><i /><i /><b>↗</b></div></div><div className={styles.stepTitle}><span>01</span><h3>Bring your world.</h3></div><p>A syllabus, a job description, or just a topic. Start with what matters to you.</p></article>
              <article className={styles.step}><div className={`${styles.stepVisual} ${styles.talkVisual}`} aria-hidden="true"><div className={styles.chatBack}>“Why does that work?”</div><div className={styles.chatFront}><span>YOUR TURN</span>“Let me walk you through it.”<div><i /><i /><i /><i /><i /><i /><i /></div></div></div><div className={styles.stepTitle}><span>02</span><h3>Think out loud.</h3></div><p>Meet an AI examiner that follows your answers and challenges your understanding.</p></article>
              <article className={styles.step}><div className={`${styles.stepVisual} ${styles.growthVisual}`} aria-hidden="true"><div className={styles.growthLine}><svg viewBox="0 0 240 120" fill="none" aria-hidden="true"><path d="M4 105 65 86 109 93 165 43 228 13" stroke="currentColor" strokeWidth="3" /><path d="m208 13 20 0 0 20" stroke="currentColor" strokeWidth="3" /></svg></div><div className={styles.growthNote}><span>YOUR NEXT STEP</span><strong>Make the trade-off clear.</strong><span>Specific feedback. Focused practice.</span></div></div><div className={styles.stepTitle}><span>03</span><h3>Build on every answer.</h3></div><p>See what worked, find the gaps, and know exactly what to practise next.</p></article>
            </div>
          </section>

          <section className={styles.experience} id="experience" aria-labelledby="experience-title">
            <div className={styles.experienceCopy}><span className={styles.eyebrow}>02 / CHOOSE YOUR COORDINATES</span><h2 id="experience-title">Same ambition.<br /><em>Your kind of room.</em></h2><p>From your first viva to your next career move. Choose the conversation you want to get better at.</p><div className={styles.modeSwitch} aria-label="Choose preview mode"><button aria-pressed={mode === "academic"} className={mode === "academic" ? styles.modeActive : ""} onClick={() => { setMode("academic"); setShowAnswer(false); }}>Academic viva <Arrow diagonal /></button><button aria-pressed={mode === "interview"} className={mode === "interview" ? styles.modeActive : ""} onClick={() => { setMode("interview"); setShowAnswer(false); }}>Job interview <Arrow diagonal /></button></div><div className={styles.topicChips}>{example.chips.map(chip => <span key={chip}>{chip}</span>)}</div><button className={styles.textLink} onClick={onGuest}>Make room for your next step <Arrow /></button></div>
            <div className={styles.demoPanel}>
              <div className={styles.demoToolbar}><span><i /> SESSION PREVIEW</span><span>ILLUSTRATIVE EXAMPLE</span></div>
              <div className={styles.demoContent} aria-live="polite"><span className={styles.demoMode}>{example.label} <span>/ {example.topic}</span></span><div className={styles.examinerLine}><div className={styles.miniOrb}>✳</div><span>YOUR EXAMINER<small>A question to get you thinking</small></span></div><h3>{example.question}</h3>{showAnswer ? <div className={styles.answer}><span>EXAMPLE RESPONSE</span><p>{example.response}</p><div><span>↗ A USEFUL NEXT STEP</span><p>{example.focus}</p></div></div> : <div className={styles.answerPlaceholder}><span>•••</span> A great answer starts with a moment to think.</div>}<button className={styles.demoButton} onClick={() => setShowAnswer(!showAnswer)}>{showAnswer ? "Back to the question" : "Explore an example answer"}<Arrow /></button></div>
              <div className={styles.demoFooter}><span>◉</span> A practice space. No audience. No pressure to be perfect.</div>
            </div>
          </section>

          <section className={styles.manifesto} aria-label="Practice on your terms"><span className={styles.asterisk}>✳</span><p>Room to pause.<br />Room to get it wrong.<br /><span>Room to get better.</span></p><div><span>DESIGNED AROUND YOU</span><p>Speak or type. Choose a supportive examiner or turn up the challenge. Your practice should meet you where you are.</p></div></section>

          <section className={styles.faqSection} id="questions" aria-labelledby="faq-title"><div><span className={styles.eyebrow}>03 / FIELD NOTES</span><h2 id="faq-title">A few good<br /><em>questions.</em></h2><p>Curiosity looks good on you.</p></div><div className={styles.faqList}>{faqs.map(([question, answer], index) => <details key={question}><summary><span className={styles.faqNumber}>0{index + 1}</span>{question}<span className={styles.faqPlus}>+</span></summary><p>{answer}</p></details>)}</div></section>

          <section className={styles.finalCta}><div className={styles.ctaOrb} aria-hidden="true" /><span className={styles.eyebrow}>YOUR NEXT CHAPTER STARTS HERE</span><h2>Meet your<br /><em>more confident self.</em></h2><button className={styles.primary} onClick={onGuest}>Step into your practice room <Arrow diagonal /></button><p>Start as a guest. Take it at your pace.</p></section>
        </main>
        <footer className={styles.footer}><Brand as="a" href="#top" aria-label="PrepSim AI home" /><span>Practice for the moments that matter.</span><div><a href="#questions">FAQs</a><LegalLinks /><button onClick={onSignIn}>Log in <Arrow diagonal /></button><a href="#top" aria-label="Back to top">↑</a></div><small>© {new Date().getFullYear()} PrepSim</small></footer>
      </div>
    </div>
  );
}
