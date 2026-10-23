"use client";

import { HeroPattern } from "@/components/OrganMotifs";
import HomeSearch from "@/components/HomeSearch";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

const views = {
  visitor: {
    title: "Find organs", accent: "and events",
    description: "Explore pipe organs, request practice time, and discover upcoming events.",
    note: "Practice requests require host approval; costs are set by each institution.",
    primary: ["/search", "Find organs"], secondary: ["/events", "Find events"]
  },
  organist: {
    title: "Find an organ", accent: "to play",
    description: "Explore organs, request practice time, and find upcoming events.",
    note: "Practice requests require host approval; costs are set by each institution.",
    primary: ["/search", "Find organs"], secondary: ["/dashboard", "My requests"]
  },
  organization: {
    title: "Offer access", accent: "and publish events",
    description: "Set free, donation-based, or paid practice access and promote your upcoming events.",
    note: "You choose prices, availability, and which practice requests to approve.",
    primary: ["/organization", "Manage listings"], secondary: ["/guide", "User guide"]
  }
};

export default function RoleAwareHome() {
  const { user, account, loading } = useAuth();
  const key = !user || loading || !account?.role ? "visitor" : account.role === "organization" ? "organization" : "organist";
  const view = views[key];
  return <section className="hero"><HeroPattern/><div className="container hero-content">
    <div className="hero-copy"><h1>{view.title} <span className="hero-title-accent">{view.accent}</span></h1><p className="lead">{view.description}</p>
      {key === "visitor" || key === "organist" ? <HomeSearch secondary={view.secondary}/> : <div className="hero-actions"><Link className="button" href={view.primary[0]}>{view.primary[1]}</Link><Link className="button-secondary" href={view.secondary[0]}>{view.secondary[1]}</Link></div>}
      <p className="hero-note">{view.note}</p>
    </div>
    {key === "visitor" && <div className="hero-publishing"><div><h2>Offer access and publish events</h2><p>Offer practice time for free, by donation, or for a fee, and publicize your upcoming events.</p></div><Link className="button-on-dark" href="/register?role=organization">Get started<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 10h13m-5-5 5 5-5 5"/></svg></Link></div>}
  </div></section>;
}
