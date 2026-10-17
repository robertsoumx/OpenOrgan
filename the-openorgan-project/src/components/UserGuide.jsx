"use client";
import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { GUIDES, guideKey } from "@/lib/guides";
export default function UserGuide() {
  const { user, account } = useAuth();
  const [choice, setChoice] = useState(null), [notice, setNotice] = useState("");
  const role = choice || (account?.role === "organization" ? "organization" : "organist");
  function setAutomatic(enabled) {
    try { localStorage.setItem(guideKey(user.uid, account.role), enabled ? "on" : "off"); setNotice(enabled ? "The guide will appear at your next sign-in on this browser." : "Automatic guides are off on this browser."); }
    catch { setNotice("Your browser could not save this preference."); }
  }
  return <section className="section"><div className="container">
    <header className="page-header"><h1>User guide</h1><p>Choose your account type to see how each feature works.</p></header>
    <div className="segmented" aria-label="Guide account type">{["organist","organization"].map(value => <button key={value} aria-pressed={role === value} className={role === value ? "active" : ""} onClick={() => setChoice(value)}>{value === "organization" ? "Institutions" : "Organists"}</button>)}</div>
    <div className="guide-layout" style={{marginTop:28}}><nav className="guide-index" aria-label="Guide topics">{GUIDES[role].map(item => <a key={item.id} href={`#${role}-${item.id}`}>{item.title}</a>)}</nav><div className="stack-lg">{GUIDES[role].map((item,i) => <article className="card guide-step" id={`${role}-${item.id}`} key={item.id}><span className="eyebrow">{i+1}</span><h2>{item.title}</h2><p>{item.text}</p><p>{item.detail}</p><Link className="text-link" href={item.href}>{item.action}</Link></article>)}</div></div>
    {user && GUIDES[account?.role] && <section className="card" style={{marginTop:28}}><h2>Introductory guide</h2><p>Change whether the guide opens after sign-in on this browser.</p><div className="form-actions"><button className="button-secondary" onClick={() => setAutomatic(true)}>Show after sign-in</button><button className="button-secondary" onClick={() => setAutomatic(false)}>Turn off automatic guide</button></div><p role="status">{notice}</p></section>}
  </div></section>;
}
