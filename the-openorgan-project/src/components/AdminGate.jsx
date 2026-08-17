"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function AdminGate({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAdmin, loading } = useAuth();

  useEffect(() => {
    if (loading || user) return;
    router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [loading, pathname, router, user]);

  if (loading) {
    return (
      <section className="section">
        <div className="container">
          <div className="skeleton" />
        </div>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="section">
        <div className="container empty-state">
          <h1>Signing you in</h1>
          <p>Checking your account session…</p>
        </div>
      </section>
    );
  }

  if (!isAdmin) {
    return (
      <section className="section">
        <div className="container empty-state">
          <h1>Administrator access required</h1>
          <p>This account is not configured as an OpenOrgan administrator.</p>
          <Link className="button secondary-button" href="/">
            Return home
          </Link>
        </div>
      </section>
    );
  }

  return children;
}
