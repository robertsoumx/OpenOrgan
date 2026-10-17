import {PipeMark} from "@/components/OrganMotifs";
import Link from "next/link";

export const metadata = {
  title: "About",
  description: "Find organs and events, offer free or paid practice access, and publish upcoming events on OpenOrgan.",
  alternates: { canonical: "/about" }
};

export default function AboutPage() {
  return <section className="section about-page"><div className="container about-shell">
    <header className="page-header"><PipeMark className="section-pipe-mark"/><h1>About OpenOrgan</h1><p className="lead">Find organs and events, offer practice access, and publish upcoming events.</p></header>
    <div className="grid-3">
      <article className="card"><h2>Find organs</h2><p>Compare instruments, locations, and practice costs before requesting access.</p><Link className="text-link" href="/search">Find organs</Link></article>
      <article className="card"><h2>Find events</h2><p>Browse recitals, concerts, and workshops by date or venue.</p><Link className="text-link" href="/events">Find events</Link></article>
      <article className="card"><h2>Offer access and publish events</h2><p>Set free, donation-based, or paid practice access and publicize your upcoming events.</p><Link className="text-link" href="/register?role=organization">Get started</Link></article>
    </div>
    <section className="card about-access"><h2>Practice access</h2><p>Institutions set availability and prices, approve requests, and arrange any payment directly.</p><p>Reference listings provide instrument information, not permission to practice.</p><Link className="text-link" href="/guide">Read the user guide</Link></section>
  </div></section>;
}
