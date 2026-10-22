"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { GUIDES, guideKey } from "@/lib/guides";

export default function UserGuide() {
  const { user, account } = useAuth();
  const [notice, setNotice] = useState(""), [choice, setChoice] = useState(null);
  const role = choice || (account?.role === "organization" ? "organization" : "organist");
  useEffect(() => {
    const readRole = () => {
      const value = new URLSearchParams(window.location.search).get("role");
      setChoice(value === "organization" || value === "organist" ? value : null);
    };
    readRole(); window.addEventListener("popstate", readRole);
    return () => window.removeEventListener("popstate", readRole);
  }, []);
  function chooseRole(event, value) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button > 0) return;
    event.preventDefault(); setChoice(value);
    const url = new URL(window.location.href);
    url.searchParams.set("role", value);
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }
  function setAutomatic(enabled) {
    try { localStorage.setItem(guideKey(user.uid, account.role), enabled ? "on" : "off"); setNotice(enabled ? "The guide will appear at your next sign-in on this browser." : "Automatic guides are off on this browser."); }
    catch { setNotice("Your browser could not save this preference."); }
  }
  return <section className="section guide-page"><div className="container">
    <header className="page-header"><h1>User guide</h1><p>Learn how to find organs and events, offer practice access, and publish events.</p></header>
    <nav className="segmented guide-activities" aria-label="Guide activities">{["organist", "organization"].map(value => <Link key={value} href={"/guide?role=" + value} onClick={event => chooseRole(event, value)} aria-current={role === value ? "page" : undefined} className={role === value ? "active" : ""}>{value === "organization" ? "Offer and publish" : "Find and attend"}</Link>)}</nav>
    <div className="guide-layout"><nav className="guide-index" aria-label="Guide topics">{GUIDES[role].map(item => <a key={item.id} href={"#" + role + "-" + item.id}>{item.title}</a>)}</nav>
      <div>{GUIDES[role].map(item => <article className="guide-step" id={role + "-" + item.id} key={item.id}><h2>{item.title}</h2><p>{item.text}</p><p>{item.detail}</p><Link className="text-link" href={item.href}>{item.action}</Link></article>)}</div>
    </div>
    {user && GUIDES[account?.role] && <section className="guide-preferences"><h2>Introductory guide</h2><p>Change whether the guide opens after sign-in on this browser.</p><div className="form-actions"><button className="button-secondary" onClick={() => setAutomatic(true)}>Show after sign-in</button><button className="button-secondary" onClick={() => setAutomatic(false)}>Turn off automatic guide</button></div><p role="status">{notice}</p></section>}
  </div></section>;
}
