"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase-client";
import { useAuth } from "@/components/AuthProvider";
import Logo from "@/components/Logo";

const publicLinks = [
  ["/search", "Organ Directory"],
  ["/events", "Events"],
  ["/about", "About"],
  ["/guide", "Guide"]
];

const organistLinks = [
  ["/search", "Find Organs"],
  ["/events", "Events"],
  ["/dashboard", "My Dashboard"],
  ["/profile", "My profile"],
  ["/guide", "Guide"]
];

const organizationLinks = [
  ["/organization", "Manage"],
  ["/search", "Organ Directory"],
  ["/events", "Events"],
  ["/verification", "Verification"],
  ["/profile", "Institution profile"],
  ["/guide", "Guide"]
];

const adminLinks = [
  ["/admin/verifications", "Verifications"],
  ["/admin/claims", "Claims"],
  ["/search", "Organ Directory"],
  ["/events", "Events"],
  ["/profile", "Profile"]
];

function isActive(pathname, href) {
  if (href === "/") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function SiteNavbar() {
  const pathname = usePathname();
  const { user, account, isAdmin, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => setMenuOpen(false), [pathname]);
  const [notifications, setNotifications] = useState(0);

  useEffect(() => {
    setNotifications(0);

    // Admin navigation does not need normal role-specific Q&A badges.
    if (isAdmin || !db || !user?.uid || !account?.role) return undefined;

    const field = account.role === "organization" ? "ownerId" : "askerId";

    return onSnapshot(
      query(collection(db, "questions"), where(field, "==", user.uid)),
      (snapshot) => {
        const count = snapshot.docs.filter((item) => {
          const question = item.data();
          return account.role === "organization"
            ? question.status === "open"
            : question.status === "answered" && !question.readByAsker;
        }).length;
        setNotifications(count);
      },
      () => setNotifications(0)
    );
  }, [account?.role, isAdmin, user?.uid]);

  const links = !user || !account?.role
    ? publicLinks
    : isAdmin
      ? adminLinks
      : account.role === "organization"
        ? organizationLinks
        : organistLinks;

  const notificationHref =
    account?.role === "organization" ? "/organization" : "/dashboard";

  return (
    <header className="site-header">
      <div className="container nav-inner">
        <Link href="/" className="brand" aria-label="The OpenOrgan Project home">
          <Logo compact />
        </Link>

        <button className="button-secondary nav-menu-toggle" aria-expanded={menuOpen} aria-controls="primary-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? "Close menu" : "Menu"}</button>
        <nav id="primary-navigation" className={menuOpen ? "nav-open" : ""} aria-label="Primary navigation">
          {links.map(([href, label]) => (
            <Link
              aria-current={isActive(pathname, href) ? "page" : undefined}
              className={isActive(pathname, href) ? "active" : ""}
              key={href}
              href={href}
            >
              {label}
              {!isAdmin && href === notificationHref && notifications > 0 && (
                <span
                  className="nav-notification"
                  aria-label={`${notifications} new item${notifications === 1 ? "" : "s"}`}
                >
                  {notifications > 9 ? "9+" : notifications}
                </span>
              )}
            </Link>
          ))}

          {!loading && user ? (
            <button className="nav-button" onClick={() => signOut(auth)}>
              Sign Out
            </button>
          ) : !loading ? (
            <>
              <Link href="/login">Sign In</Link>
              <Link className="nav-cta" href="/register">Join</Link>
            </>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
