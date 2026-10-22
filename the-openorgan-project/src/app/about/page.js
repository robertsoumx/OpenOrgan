import Link from "next/link";

export const metadata = {
  title: "About",
  description: "Find organs and events, offer free or paid practice access, and publish upcoming events on OpenOrgan. Developed by Robert Sou.",
  alternates: { canonical: "/about" }
};

export default function AboutPage() {
  return <section className="section about-page"><div className="container about-shell">
    <header className="page-header"><h1>About OpenOrgan</h1><p className="lead">Find organs and events, offer practice access, and publish upcoming events.</p></header>
    <div className="about-actions">
      <section><h2><Link href="/search">Find organs</Link></h2><p>Compare instruments, locations, and practice costs before requesting access.</p></section>
      <section><h2><Link href="/events">Find events</Link></h2><p>Browse recitals, concerts, and workshops by date or venue.</p></section>
      <section><h2>Offer access and publish events</h2><p>Set free, donation-based, or paid practice access and publicize your upcoming events.</p><Link className="text-link" href="/register?role=organization">Get started</Link></section>
    </div>
    <section className="about-access"><h2>Practice access</h2><p>Institutions set availability and prices, approve requests, and arrange any payment directly.</p><p>Reference listings provide instrument information, not permission to practice.</p><Link className="text-link" href="/guide">Read the user guide</Link></section>
  </div></section>;
}
