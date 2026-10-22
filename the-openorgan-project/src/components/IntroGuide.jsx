"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { GUIDES, guideKey } from "@/lib/guides";

export default function IntroGuide() {
  const { user, account, loading, isAdmin, setupRequired } = useAuth();
  const dialog = useRef(null), titleRef = useRef(null), shown = useRef("");
  const [step, setStep] = useState(0), [optOut, setOptOut] = useState(false);
  const role = account?.role;
  const steps = GUIDES[role] || [];
  useEffect(() => {
    if (loading) return;
    if (!user) {
      try { if(shown.current) sessionStorage.removeItem(shown.current); } catch {}
      shown.current = ""; return;
    }
    if (isAdmin || setupRequired || !steps.length) return;
    const key = guideKey(user.uid, role);
    if (shown.current === key) return;
    shown.current = key;
    let suppressed = false;
    try { suppressed = localStorage.getItem(key) === "off" || sessionStorage.getItem(key) === "shown"; } catch {}
    if (!suppressed) {
      try { sessionStorage.setItem(key,"shown"); } catch {}
      setStep(0); setOptOut(false); dialog.current?.showModal();
    }
  }, [loading, user?.uid, role, isAdmin, setupRequired, steps.length]);
  useEffect(() => { if (!user) dialog.current?.close(); }, [user?.uid]);
  useEffect(() => { if(dialog.current?.open) titleRef.current?.focus(); }, [step, role]);
  function finish() {
    if (user && role) {
      try { localStorage.setItem(guideKey(user.uid, role), optOut ? "off" : "on"); } catch {}
    }
    dialog.current?.close();
  }
  if (!steps.length) return null;
  const item = steps[Math.min(step, steps.length - 1)];
  return <dialog ref={dialog} className="guide-dialog" aria-labelledby="intro-title" onCancel={event => { event.preventDefault(); finish(); }}>
    <div className="guide-header"><p className="guide-progress" aria-live="polite">Step {Math.min(step + 1, steps.length)} of {steps.length}</p><button type="button" className="icon-button" aria-label="Close guide" onClick={finish}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15"/></svg></button></div>
    <div key={item.id} aria-live="polite"><h2 id="intro-title" ref={titleRef} tabIndex={-1}>{item.title}</h2><p>{item.text}</p><p>{item.detail}</p></div>
    <label className="guide-checkbox"><input type="checkbox" checked={optOut} onChange={e => setOptOut(e.target.checked)} />Don't show automatically again on this browser</label>
    <div className="form-actions"><button className="button-secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</button>{step < steps.length - 1 ? <button className="button" onClick={() => setStep(step + 1)}>Next</button> : <button className="button" onClick={finish}>Finish guide</button>}<Link href={item.href} onClick={finish}>{item.action}</Link></div>
  </dialog>;
}
