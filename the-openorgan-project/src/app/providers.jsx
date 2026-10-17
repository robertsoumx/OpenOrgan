"use client";

import InterfaceMotion from "@/components/InterfaceMotion";
import IntroGuide from "@/components/IntroGuide";
import AuthProvider from "@/components/AuthProvider";
import AnalyticsProvider from "@/components/AnalyticsProvider";

export default function Providers({ children }) {
  return (
    <AuthProvider>
      <AnalyticsProvider>{children}<IntroGuide /><InterfaceMotion /></AnalyticsProvider>
    </AuthProvider>
  );
}
