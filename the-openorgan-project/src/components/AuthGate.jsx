"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import AccountSetupRecovery from "@/components/AccountSetupRecovery";

function destinationForRole(role) {
  if (role === "organization") return "/organization";
  if (role === "organist") return "/dashboard";
  return "/";
}

export default function AuthGate({ children, role }) {
  const router = useRouter();
  const {
    user,
    account,
    loading,
    setupRequired,
    accountError,
    refresh
  } = useAuth();
  const roleMismatch = Boolean(role && account?.role && account.role !== role);

  useEffect(() => {
    if (roleMismatch) {
      router.replace(destinationForRole(account.role));
    }
  }, [account?.role, roleMismatch, router]);

  if (loading || roleMismatch) {
    return (
      <section className="section">
        <div className="container"><div className="skeleton" /></div>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="section">
        <div className="container empty-state">
          <h1>Sign in required</h1>
          <p>You need an account to use this page.</p>
          <Link className="button" href="/login">Sign In</Link>
        </div>
      </section>
    );
  }

  if (accountError) {
    return (
      <section className="section">
        <div className="container empty-state">
          <h1>Your account could not be loaded.</h1>
          <p>{accountError}</p>
          <button className="button" onClick={() => refresh()}>Try Again</button>
        </div>
      </section>
    );
  }

  if (setupRequired || !account?.role) {
    return <AccountSetupRecovery />;
  }

  return children;
}
