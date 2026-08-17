"use client";

import AuthProvider from "@/components/AuthProvider";
import AnalyticsProvider from "@/components/AnalyticsProvider";

export default function Providers({ children }) {
  return (
    <AuthProvider>
      <AnalyticsProvider>{children}</AnalyticsProvider>
    </AuthProvider>
  );
}
