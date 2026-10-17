"use client";

import { HeroPattern, PipeMark } from "@/components/OrganMotifs";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

const views = {
  visitor: {
    title: "Find organs and events",
    description: "Browse pipe organs, attend recitals, and request practice time from participating institutions.",
    primary: ["/search", "Find organs"], secondary: ["/events", "Browse events"]
  },
  organist: {
    title: "Find an organ to play",
    description: "Search instruments and manage your practice requests.",
    primary: ["/search", "Find organs"], secondary: ["/dashboard", "My requests"]
  },
  organization: {
    title: "Manage your institution",
    description: "Update organ listings, review practice requests, and publish events.",
    primary: ["/organization", "Open dashboard"], secondary: ["/guide", "User guide"]
  }
};

export default function RoleAwareHome() {
  const { user, account, loading } = useAuth();
  const key = !user || loading || !account?.role ? "visitor" : account.role === "organization" ? "organization" : "organist";
  const view = views[key];
  return <section className="hero"><HeroPattern/><div className="container hero-content">
    <div className="hero-copy"><span className="hero-brand-note"><PipeMark/>The OpenOrgan Project</span><h1>{view.title}</h1><p className="lead">{view.description}</p>
      <div className="hero-actions"><Link className="button" href={view.primary[0]}>{view.primary[1]}</Link><Link className="button-secondary" href={view.secondary[0]}>{view.secondary[1]}</Link></div>
      <p className="hero-note">Practice requests are available only on listings that accept bookings.</p>
    </div>
  </div></section>;
}
