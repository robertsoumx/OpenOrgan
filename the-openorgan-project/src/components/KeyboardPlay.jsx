"use client";

import { useEffect, useRef, useState } from "react";

const notes = [
  [60, "C4", 0], [61, "C sharp 4", .64], [62, "D4", 1], [63, "D sharp 4", 1.64],
  [64, "E4", 2], [65, "F4", 3], [66, "F sharp 4", 3.64], [67, "G4", 4],
  [68, "G sharp 4", 4.64], [69, "A4", 5], [70, "A sharp 4", 5.64], [71, "B4", 6], [72, "C5", 7]
];

export default function KeyboardPlay() {
  const [sound, setSound] = useState(false), [active, setActive] = useState(null), [notice, setNotice] = useState(""), [enabling, setEnabling] = useState(false);
  const [focusNote, setFocusNote] = useState(60);
  const context = useRef(null), voices = useRef(new Set()), timer = useRef(null), mounted = useRef(false);
  function silence() { voices.current.forEach(voice => { try { voice.stop(); } catch {} }); voices.current.clear(); }
  useEffect(() => {
    mounted.current = true;
    const hidden = () => { if (document.hidden) { silence(); clearTimeout(timer.current); setActive(null); } };
    document.addEventListener("visibilitychange", hidden);
    return () => { mounted.current = false; document.removeEventListener("visibilitychange", hidden); clearTimeout(timer.current); silence(); context.current?.close(); };
  }, []);

  async function toggleSound() {
    if (enabling) return;
    if (sound) { silence(); setSound(false); return; }
    setEnabling(true);
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw new Error();
      context.current ||= new Audio();
      await context.current.resume();
      if (mounted.current) { setSound(true); setNotice(""); }
    } catch { if (mounted.current) setNotice("Sound is unavailable in this browser; the keys still respond visually."); }
    finally { if (mounted.current) setEnabling(false); }
  }

  function play([midi]) {
    setActive(midi); clearTimeout(timer.current);
    timer.current = setTimeout(() => { if (mounted.current) setActive(null); }, 550);
    const audio = context.current;
    if (!sound || !audio || audio.state !== "running") return;
    try {
      silence();
      const oscillator = audio.createOscillator(), envelope = audio.createGain(), now = audio.currentTime;
      oscillator.setPeriodicWave(audio.createPeriodicWave(new Float32Array(8), new Float32Array([0, 1, .3, .16, .08, .04, .02, .01])));
      oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12);
      envelope.gain.setValueAtTime(0, now);
      envelope.gain.linearRampToValueAtTime(.12, now + .035);
      envelope.gain.exponentialRampToValueAtTime(.001, now + .65);
      oscillator.connect(envelope); envelope.connect(audio.destination);
      voices.current.add(oscillator);
      oscillator.onended = () => { voices.current.delete(oscillator); oscillator.disconnect(); envelope.disconnect(); };
      oscillator.start(now); oscillator.stop(now + .7);
    } catch { setSound(false); setNotice("Sound stopped; try enabling it again."); }
  }

  function navigate(event) {
    const key = event.key;
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(key)) return;
    event.preventDefault();
    const next = key === "Home" ? 60 : key === "End" ? 72 : 60 + ((focusNote - 60 + (key === "ArrowRight" ? 1 : -1) + notes.length) % notes.length);
    setFocusNote(next);
    event.currentTarget.querySelector('[data-note="' + next + '"]')?.focus();
  }

  return <div className="keyboard-play">
    <div className="keyboard-caption"><span className="keyboard-title">Play a few notes</span><span className="keyboard-instruction">{sound ? "Synthesized tones" : "Tap a key, or turn on sound"}</span>
      <button type="button" className="sound-toggle" aria-pressed={sound} disabled={enabling} onClick={toggleSound}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m11 5-5 4H3v6h3l5 4Z"/>{sound ? <><path d="M15 8c3 2 3 6 0 8M18 5c5 4 5 10 0 14"/></> : <path d="m16 9 6 6m0-6-6 6"/>}</svg>{enabling ? "Enabling..." : sound ? "Sound on" : "Sound off"}</button>
    </div>
    <div className="keyboard-scroll"><div className="playable-keyboard" role="group" aria-label="One-octave keyboard" aria-describedby="keyboard-help" onKeyDown={navigate}>{notes.map(note => {
      const [midi, name, position] = note, sharp = !Number.isInteger(position);
      return <button key={midi} type="button" data-note={midi} tabIndex={focusNote === midi ? 0 : -1} onFocus={() => setFocusNote(midi)} aria-label={"Play " + name} className={"music-key " + (sharp ? "music-key-sharp" : "music-key-natural") + (active === midi ? " is-playing" : "")} style={{ "--key-position": position }} onClick={() => play(note)}><span>{sharp ? name[0] + "♯" : name[0]}</span></button>;
    })}</div></div>
    <p id="keyboard-help" className="visually-hidden">Use the arrow keys to choose a note and Enter or Space to play.</p>
    {notice && <p className="keyboard-notice" role="status">{notice}</p>}
  </div>;
}
