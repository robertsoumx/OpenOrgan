"use client";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
export default function AuthGate({ children, role }) {
  const { user, account, loading } = useAuth();
  if (loading) return <section className="section"><div className="container"><div className="skeleton" /></div></section>;
  if (!user) return <section className="section"><div className="container empty-state"><h1>Sign in required</h1><p>You need an account to use this page.</p><Link className="button" href="/login">Sign In</Link></div></section>;
  if (role && account?.role !== role) return <section className="section"><div className="container empty-state"><h1>Different account type required</h1><p>This page is for {role} accounts.</p></div></section>;
  return children;
}
