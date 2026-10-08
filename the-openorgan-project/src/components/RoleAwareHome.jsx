"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

const views = {
  visitor: {
    eyebrow: "Greater Boston",
    title: "Extraordinary sound. Open doors.",
    description: "Discover Boston’s church organs, find your next recital, and connect with hosts for practice access.",
    primary: ["/search", "Explore organs"],
    secondary: ["/events", "Explore events"],
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
            <span className="hero-note">Reference listings document instruments. Practice access is enabled only by participating hosts.</span>
          </div>

          <div className="hero-art">
            <div className="hero-art-topline"><span>Music with a place</span><span>Greater Boston</span></div>
            <svg viewBox="0 0 500 390" role="img" aria-label="Stylized pipe organ illustration">
              <circle cx="390" cy="92" r="66" fill="#cf91a5"/><path d="M15 300L460 130V360H15Z" fill="#245460"/>
              <path d="M78 338V146Q78 42 250 42Q422 42 422 146V338" fill="none" stroke="#728c85" strokeWidth="2"/>
              {[115,151,187,223,259,295,331,367].map((x,i) => <g key={x}><rect x={x} y={90 + Math.abs(3.5-i)*28} width="22" height={235-Math.abs(3.5-i)*28} fill={i%2 ? "#ecd094" : "#f8e4b8"}/><path d={`M${x+5} ${140+Math.abs(3.5-i)*28}h12v10h-12z`} fill="#8e7454"/></g>)}
              <path d="M100 329H399V340H100Z" fill="#cf91a5"/><path d="M93 347H406" stroke="#ecd094" strokeWidth="2"/>
              <path d="M25 82h33M41 65v33" stroke="#ecd094" strokeWidth="2"/>
            </svg>
            <div className="hero-art-caption"><strong>Hear it. Play it.</strong><Link href="/search">Explore the instruments</Link></div>
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
              <svg className="feature-arrow" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
