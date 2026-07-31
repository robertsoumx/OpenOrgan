"use client";

import Link from "next/link";
import Logo from "@/components/Logo";
import { useAuth } from "@/components/AuthProvider";

const views = {
  visitor: {
    eyebrow: "Beginning in Greater Boston",
    title: "Find an organ. Share an instrument.",
    description: "Practice access, organ events, and trusted local connections.",
    primary: ["/search", "Explore Organs"],
    secondary: ["/register", "Join the Project"],
    features: [
      ["01", "Explore", "Browse organs and events on a live Greater Boston map."],
      ["02", "Connect", "Organists and organizations coordinate access directly."],
      ["03", "Build trust", "Completed sessions create useful two-way reviews."]
    ]
  },
  organist: {
    eyebrow: "Your organist account",
    title: "Find a place to practice.",
    description: "Browse instruments, request sessions, and keep your plans in one dashboard.",
    primary: ["/search", "Find Organs"],
    secondary: ["/dashboard", "Open My Dashboard"],
    features: [
      ["01", "Find", "Search claimed and clearly marked reference listings."],
      ["02", "Request", "Send practice requests and manage approved sessions."],
      ["03", "Participate", "Ask questions, join events, and build your trust profile."]
    ]
  },
  organization: {
    eyebrow: "Your organization account",
    title: "Manage access and promote events.",
    description: "Maintain listings, review requests, answer questions, and publish local programs.",
    primary: ["/organization", "Manage Listings"],
    secondary: ["/profile", "Organization Profile"],
    features: [
      ["01", "List", "Add instruments and keep public access information current."],
      ["02", "Review", "Approve requests with the organist’s profile and trust history."],
      ["03", "Promote", "Publish concerts, workshops, services, and community events."]
    ]
  }
};

export default function RoleAwareHome() {
  const { user, account, loading } = useAuth();
  const key = !user || loading || !account?.role
    ? "visitor"
    : account.role === "organization"
      ? "organization"
      : "organist";
  const view = views[key];

  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">{view.eyebrow}</span>
            <h1>{view.title}</h1>
            <p>{view.description}</p>
            <div className="hero-actions">
              <Link className="button" href={view.primary[0]}>
                {view.primary[1]}
              </Link>
              <Link className="button-secondary" href={view.secondary[0]}>
                {view.secondary[1]}
              </Link>
            </div>
          </div>

          <div className="hero-logo-panel">
            <Logo />
            <p>Open access, one instrument at a time.</p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container grid-3">
          {view.features.map(([number, title, description]) => (
            <article className="feature-card" key={title}>
              <span>{number}</span>
              <h2>{title}</h2>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
