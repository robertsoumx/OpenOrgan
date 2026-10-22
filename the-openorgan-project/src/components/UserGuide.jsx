"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { GUIDES, guideKey } from "@/lib/guides";
import TaskGlyph from "@/components/TaskGlyph";

export default function UserGuide() {
  const { user, account } = useAuth();
  const [notice, setNotice] = useState(""), [choice, setChoice] = useState(null);
  const [topic, setTopic] = useState("");
  const role = choice || (account?.role === "organization" ? "organization" : "organist");
  const activeTopic = topic === "closed" || GUIDES[role].some(item => item.id === topic) ? topic : GUIDES[role][0].id;
  useEffect(() => {
    const readRole = () => {
      const value = new URLSearchParams(window.location.search).get("role");
      setChoice(value === "organization" || value === "organist" ? value : null);
    };
    readRole(); window.addEventListener("popstate", readRole);
    return () => window.removeEventListener("popstate", readRole);
  }, []);
  useEffect(() => {
    const readTopic = () => {
      const prefix = "#" + role + "-", hash = window.location.hash;
      if (hash.startsWith(prefix)) setTopic(hash.slice(prefix.length));
    };
    readTopic(); window.addEventListener("hashchange", readTopic);
    return () => window.removeEventListener("hashchange", readTopic);
  }, [role]);
  function chooseRole(event, value) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button > 0) return;
    event.preventDefault(); setChoice(value); setTopic("");
    const url = new URL(window.location.href);
    url.searchParams.set("role", value);
    url.hash = "";
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }
  function setAutomatic(enabled) {
    try { localStorage.setItem(guideKey(user.uid, account.role), enabled ? "on" : "off"); setNotice(enabled ? "The guide will appear at your next sign-in on this browser." : "Automatic guides are off on this browser."); }
    catch { setNotice("Your browser could not save this preference."); }
  }
  return <section className="section guide-page"><div className="container">
    <header className="page-header"><h1>User guide</h1><p>Learn how to find organs and events, offer practice access, and publish events.</p></header>
    <nav className="segmented guide-activities" aria-label="Guide activities">{["organist", "organization"].map(value => <Link key={value} href={"/guide?role=" + value} onClick={event => chooseRole(event, value)} aria-current={role === value ? "page" : undefined} className={role === value ? "active" : ""}>{value === "organization" ? "Offer and publish" : "Find and attend"}</Link>)}</nav>
    <div className="guide-layout"><nav className="guide-index" aria-label="Guide topics">{GUIDES[role].map(item => <a key={item.id} aria-current={activeTopic === item.id ? "location" : undefined} href={"#" + role + "-" + item.id} onClick={() => setTopic(item.id)}>{item.title}</a>)}</nav>
      <div>{GUIDES[role].map(item => <details className="guide-step" id={role + "-" + item.id} key={item.id} open={activeTopic === item.id}><summary onClick={event => { event.preventDefault(); setTopic(activeTopic === item.id ? "closed" : item.id); }}><TaskGlyph kind={/event/i.test(item.title) ? "event" : /access|request|account|profile/i.test(item.title) ? "access" : "organ"}/><h2>{item.title}</h2><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h12M10 4v12"/></svg></summary><div className="guide-step-content"><p>{item.text}</p><p>{item.detail}</p><Link className="text-link" href={item.href}>{item.action}</Link></div></details>)}</div>
    </div>
    {user && GUIDES[account?.role] && <section className="guide-preferences"><h2>Introductory guide</h2><p>Change whether the guide opens after sign-in on this browser.</p><div className="form-actions"><button className="button-secondary" onClick={() => setAutomatic(true)}>Show after sign-in</button><button className="button-secondary" onClick={() => setAutomatic(false)}>Turn off automatic guide</button></div><p role="status">{notice}</p></section>}
  </div></section>;
}
