"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function AccountHomeRedirect() {
  const router = useRouter();
  const { user, account, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    router.replace(account?.role === "organization" ? "/organization" : "/dashboard");
  }, [account?.role, loading, router, user]);

  return (
    <section className="section">
      <div className="container">
        <div className="skeleton" />
      </div>
    </section>
  );
}
