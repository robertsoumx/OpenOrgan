"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

const views = {
  visitor: {
    eyebrow: "Greater Boston",
    title: "Find an organ. Promote events.",
    description: "Practice access, local events, and trusted connections.",
    primary: ["/search", "Explore organs"],
    secondary: ["/register", "Join the project"],
    features: [
      ["Find", "Nearby church organs", "/search"],
      ["Request", "Practice access", "/register"],
      ["Go", "Concerts and events", "/events"]
    ]
  },
  organist: {
    eyebrow: "Organist",
    title: "Your next practice room may be nearby.",
    description: "Find instruments, request time, and keep everything in one place.",
    primary: ["/search", "Find organs"],
    secondary: ["/dashboard", "My dashboard"],
    features: [
      ["Nearby", "Route-ranked organs", "/search"],
      ["Simple", "Requests and changes", "/dashboard"],
      ["Trusted", "Your profile and reviews", "/profile"]
    ]
  },
  organization: {
    eyebrow: "Organization",
    title: "Share an instrument. Fill the room.",
    description: "Manage access, requests, and events without extra administration.",
    primary: ["/organization", "Manage"],
    secondary: ["/profile", "Profile"],
    features: [
      ["List", "Your instruments", "/organization"],
      ["Review", "Practice requests", "/organization"],
      ["Promote", "Events and programs", "/events"]
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

  const trustHref = !user ? "/register" : account?.role === "organization" ? "/profile" : "/profile";

  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">{view.eyebrow}</span>
            <h1>{view.title}</h1>
            <p>{view.description}</p>
            <div className="hero-actions">
              <Link className="button" href={view.primary[0]}>{view.primary[1]}</Link>
              <Link className="button-secondary" href={view.secondary[0]}>{view.secondary[1]}</Link>
            </div>
          </div>

          <div className="hero-visual" aria-label="OpenOrgan shortcuts">
            <div className="hero-pipes" aria-hidden="true">
              <span /><span /><span /><span />
            </div>
            <nav className="hero-shortcuts" aria-label="Project shortcuts">
              <Link className="button-secondary hero-shortcut" href="/search">
                <span>Practice</span><span aria-hidden="true">→</span>
              </Link>
              <Link className="button-secondary hero-shortcut" href="/events">
                <span>Events</span><span aria-hidden="true">→</span>
              </Link>
              <Link className="button-secondary hero-shortcut" href={trustHref}>
                <span>Trust</span><span aria-hidden="true">→</span>
              </Link>
            </nav>
          </div>
        </div>
      </section>

      <section className="section home-feature-section">
        <div className="container home-feature-grid">
          {view.features.map(([title, description, href], index) => (
            <Link
              className={`feature-card feature-tone-${index + 1}`}
              href={href}
              key={title}
            >
              <span className="feature-index">0{index + 1}</span>
              <div>
                <h2>{title}</h2>
                <p>{description}</p>
              </div>
              <span className="feature-arrow" aria-hidden="true">↗</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
