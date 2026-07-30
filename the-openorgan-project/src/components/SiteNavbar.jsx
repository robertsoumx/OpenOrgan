"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase-client";
import { useAuth } from "@/components/AuthProvider";
import Logo from "@/components/Logo";

export default function SiteNavbar() {
  const pathname = usePathname();
  const { user, account } = useAuth();
  const links = [["/search", "Find Organs"], ["/events", "Events"], ["/about", "About"]];
  return <header className="site-header"><div className="container nav-inner"><Link href="/" className="brand"><Logo compact /></Link><nav>{links.map(([href,label]) => <Link className={pathname === href ? "active" : ""} key={href} href={href}>{label}</Link>)}{user ? <><Link href={account?.role === "organization" ? "/organization" : "/dashboard"}>Dashboard</Link><Link href="/profile">Profile</Link><button className="nav-button" onClick={() => signOut(auth)}>Sign Out</button></> : <><Link href="/login">Sign In</Link><Link className="nav-cta" href="/register">Join</Link></>}</nav></div></header>;
}
