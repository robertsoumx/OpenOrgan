import Link from "next/link";

export const metadata = {
  title: "About",
  description: "OpenOrgan helps organists find instruments, request practice access, and discover organ events.",
  alternates: { canonical: "/about" }
};

export default function AboutPage() {
  return <section className="section about-page"><div className="container about-shell">
    <header className="page-header"><h1>About OpenOrgan</h1><p className="lead">OpenOrgan connects organists with institutions that share instruments, practice access, and events.</p></header>
    <div className="grid-3">
      <article className="card"><h2>Find an organ</h2><p>Browse instrument details and check whether an institution accepts practice requests.</p><Link className="text-link" href="/search">Browse organs</Link></article>
      <article className="card"><h2>Attend an event</h2><p>Find recitals and confirm the program with the organizer.</p><Link className="text-link" href="/events">Browse events</Link></article>
      <article className="card"><h2>Manage an institution</h2><p>List instruments, publish events, and decide how practice access works.</p><Link className="text-link" href="/register">Create an account</Link></article>
    </div>
    <section className="card about-access"><h2>Practice access</h2><p>Institutions choose whether to accept requests and must approve each reservation.</p><p>Reference listings from the Pipe Organ Database provide information without granting access.</p><Link className="text-link" href="/guide">Read the user guide</Link></section>
  </div></section>;
}
