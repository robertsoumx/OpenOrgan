"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase-client";
import { useAuth } from "@/components/AuthProvider";
import Logo from "@/components/Logo";

const discoveryLinks = [["/search", "Find organs"], ["/events", "Find events"]];
function isActive(pathname, href) { return pathname === href || pathname.startsWith(href + "/"); }

export default function SiteNavbar() {
  const pathname = usePathname();
  const { user, account, isAdmin, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false), [notifications, setNotifications] = useState(0);
  const [signingOut, setSigningOut] = useState(false), [notice, setNotice] = useState("");
  const accountMenu = useRef(null), menuButton = useRef(null);
  useEffect(() => { setMenuOpen(false); if (accountMenu.current) accountMenu.current.open = false; }, [pathname]);
  useEffect(() => {
    const outside = event => { if (accountMenu.current && !accountMenu.current.contains(event.target)) accountMenu.current.open = false; };
    const escape = event => {
      if (event.key !== "Escape") return;
      if (accountMenu.current?.open) { accountMenu.current.open = false; accountMenu.current.querySelector("summary")?.focus(); }
      else if (menuOpen) { setMenuOpen(false); menuButton.current?.focus(); }
    };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [menuOpen]);
  useEffect(() => {
    setNotifications(0);
    if (isAdmin || !db || !user?.uid || !account?.role) return;
    const organization = account.role === "organization";
    return onSnapshot(query(collection(db, "questions"), where(organization ? "ownerId" : "askerId", "==", user.uid)),
      snapshot => setNotifications(snapshot.docs.filter(item => organization ? item.data().status === "open" : item.data().status === "answered" && !item.data().readByAsker).length),
      () => setNotifications(0));
  }, [account?.role, isAdmin, user?.uid]);
  const signedIn = Boolean(user && account?.role);
  const dashboard = account?.role === "organization" ? "/organization" : "/dashboard";
  const links = isAdmin && signedIn ? [["/admin/verifications", "Verifications"], ["/admin/claims", "Claims"], ["/admin/privacy", "Privacy requests"], ...discoveryLinks]
    : signedIn ? [...discoveryLinks, [dashboard, account.role === "organization" ? "Manage listings" : "My dashboard"]]
    : [...discoveryLinks, ["/about", "About"]];
  async function logout() {
    setSigningOut(true); setNotice("");
    try { await signOut(auth); } catch { setNotice("Sign-out failed; please try again."); } finally { setSigningOut(false); }
  }
  return <header className="site-header">
    <div className="container nav-inner">
      <Link href="/" className="brand" aria-label="The OpenOrgan Project home"><Logo compact/></Link>
      <button ref={menuButton} type="button" className="button-secondary nav-menu-toggle" aria-expanded={menuOpen} aria-controls="primary-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? "Close menu" : "Menu"}</button>
      <nav id="primary-navigation" className={menuOpen ? "nav-open" : ""} aria-label="Primary navigation">
        {links.map(([href, label]) => <Link key={href} href={href} aria-current={isActive(pathname, href) ? "page" : undefined} className={isActive(pathname, href) ? "active" : ""}>{label}{!isAdmin && href === dashboard && notifications > 0 && <span className="nav-notification" aria-label={notifications + " unread updates"}>{notifications > 9 ? "9+" : notifications}</span>}</Link>)}
        {!loading && (user ? <details className="nav-account" ref={accountMenu}>
          <summary>Account<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 7 5 5 5-5"/></svg></summary>
          <div className="account-menu" onClick={event => { if (event.target.closest("a")) { accountMenu.current.open = false; setMenuOpen(false); } }}>
            <Link href="/profile">{account?.role === "organization" ? "Institution profile" : "My profile"}</Link>
            {account?.role === "organization" && <Link href="/verification">Verification</Link>}
            <Link href="/guide">User guide</Link><Link href="/about">About OpenOrgan</Link>
            <button type="button" onClick={logout} disabled={signingOut}>{signingOut ? "Signing out..." : "Sign out"}</button>
          </div>
        </details> : <><Link href="/login">Sign in</Link><Link className="nav-cta" href="/register">Create account</Link></>)}
      </nav>
    </div>
    {notice && <p className="nav-error container" role="alert">{notice}</p>}
  </header>;
}
