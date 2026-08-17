"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { trackEvent } from "@/lib/analytics-client";

export default function AnalyticsProvider({ children }) {
  const pathname = usePathname();
  const { account, loading } = useAuth();
  const lastPath = useRef("");

  useEffect(() => {
    if (loading || !pathname || lastPath.current === pathname) return;
    lastPath.current = pathname;
    trackEvent("page_view", {
      feature: "navigation",
      role: account?.role || "public"
    });
  }, [pathname, account?.role, loading]);

  return children;
}
