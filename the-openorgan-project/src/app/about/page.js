import Link from "next/link";
import TaskGlyph from "@/components/TaskGlyph";

export const metadata = {
  title: "About",
  description: "Find organs and events, offer free or paid practice access, and publish upcoming events on OpenOrgan. Developed by Robert Sou.",
  alternates: { canonical: "/about" }
};

export default function AboutPage() {
  return <section className="section about-page"><div className="container about-shell">
    <header className="page-header"><h1>About OpenOrgan</h1><p className="lead">Find organs and events, offer practice access, and publish upcoming events.</p></header>
    <nav className="about-paths" aria-label="Explore OpenOrgan">
      {[
        ["/search", "organ", "Find organs", "Compare instruments, locations, and practice costs before requesting access."],
        ["/events", "event", "Find events", "Browse recitals, concerts, and workshops by date or venue."],
        ["/register?role=organization", "access", "Offer access and publish events", "Set free, donation-based, or paid practice access and publicize your upcoming events."]
      ].map(([href, kind, title, text]) => <Link key={href} href={href} className="about-path"><TaskGlyph kind={kind}/><div><h2>{title}</h2><p>{text}</p></div><svg className="path-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg></Link>)}
    </nav>
    <section className="about-access"><TaskGlyph kind="access"/><div><h2>Practice access</h2><p>Institutions set availability and prices, approve requests, and arrange any payment directly.</p><p>Reference listings provide instrument information, not permission to practice.</p><Link className="text-link" href="/guide">Read the user guide</Link></div></section>
  </div></section>;
}
