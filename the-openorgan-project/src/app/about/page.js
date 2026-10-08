import Link from "next/link";

export const metadata = {
  title: "About",
  description: "The mission behind The OpenOrgan Project: connecting organists with churches and organizations that share instruments and events.",
  alternates: { canonical: "/about" }
};

const principles = [
  {
    className: "about-principle-crimson",
    number: "01",
    title: "Open doors",
    body: "Hosts control access. Organists get a clear way to ask.",
    href: "/search"
  },
  {
    className: "about-principle-pink",
    number: "02",
    title: "Local first",
    body: "Build a useful Greater Boston network before expanding.",
    href: "/search"
  },
  {
    className: "about-principle-wine",
    number: "03",
    title: "Earn trust",
    body: "Completed sessions build useful history on both sides.",
    href: "/register"
  }
];

export default function AboutPage() {
  return (
    <section className="section about-page">
      <div className="container about-shell">
        <div className="about-stage">
          <div className="about-intro">
            <span className="eyebrow">The mission</span>
            <h1>Access instruments. Promote events.</h1>
            <p className="lead">
              The OpenOrgan Project connects organists and listeners with Greater Boston’s church organs, public performances, and organization-approved practice access.
            </p>
            <div className="about-tags" aria-label="Project focus">
              <Link href="/search">Practice</Link>
              <Link href="/events">Events</Link>
              <Link href="/register">Community</Link>
            </div>
          </div>

          <div className="about-signal" aria-hidden="true">
            <span className="about-signal-bar about-signal-one" />
            <span className="about-signal-bar about-signal-two" />
            <span className="about-signal-bar about-signal-three" />
            <span className="about-signal-bar about-signal-four" />
          </div>
        </div>

        <div className="about-principles">
          {principles.map((item) => (
            <Link
              className={`about-principle ${item.className}`}
              href={item.href}
              key={item.number}
            >
              <span>{item.number}</span>
              <h2>{item.title}</h2>
              <p>{item.body}</p>
            </Link>
          ))}
        </div>

        <div className="about-band">
          <div>
            <span className="eyebrow">Open source · community led</span>
            <h2>One useful local network.</h2>
          </div>
          <p>Claimed listings, church-organ references, events, and verified access in one place.</p>
        </div>
      </div>
    </section>
  );
}
