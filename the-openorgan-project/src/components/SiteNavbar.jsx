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
  ["/about", "About"]
];

const organistLinks = [
  ["/search", "Find Organs"],
  ["/events", "Events"],
  ["/dashboard", "My Dashboard"],
  ["/profile", "My Profile"]
];

const organizationLinks = [
  ["/organization", "Manage"],
  ["/search", "Organ Directory"],
  ["/events", "Events"],
  ["/verification", "Verification"],
  ["/profile", "Organization Profile"]
];

function isActive(pathname, href) {
  if (href === "/") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function SiteNavbar() {
  const pathname = usePathname();
  const { user, account, loading } = useAuth();
  const [notifications, setNotifications] = useState(0);

  useEffect(() => {
    setNotifications(0);
    if (!db || !user?.uid || !account?.role) return undefined;

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
  }, [account?.role, user?.uid]);

  const links = !user || !account?.role
    ? publicLinks
    : account.role === "organization"
      ? organizationLinks
      : organistLinks;

  const notificationHref = account?.role === "organization" ? "/organization" : "/dashboard";

  return (
    <header className="site-header">
      <div className="container nav-inner">
        <Link href="/" className="brand" aria-label="The OpenOrgan Project home">
          <Logo compact />
        </Link>

        <nav aria-label="Primary navigation">
          {links.map(([href, label]) => (
            <Link className={isActive(pathname, href) ? "active" : ""} key={href} href={href}>
              {label}
              {href === notificationHref && notifications > 0 && (
                <span className="nav-notification" aria-label={`${notifications} new item${notifications === 1 ? "" : "s"}`}>
                  {notifications > 9 ? "9+" : notifications}
                </span>
              )}
            </Link>
          ))}

          {!loading && user ? (
            <button className="nav-button" onClick={() => signOut(auth)}>Sign Out</button>
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
