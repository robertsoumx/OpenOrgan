import Logo from "@/components/Logo";

export const metadata = {
  title: "About",
  description: "About the mission behind The OpenOrgan Project."
};

export default function AboutPage() {
  return (
    <section className="section about-page">
      <div className="container about-shell">
        <div className="about-hero-grid">
          <div className="about-logo-panel interactive-panel">
            <Logo />
            <span className="eyebrow">About the mission</span>
          </div>

          <div className="about-intro">
            <h1>More access. More music.</h1>
            <p className="lead">
              The OpenOrgan Project is an open-source mission aiming to connecting organists with churches, schools, and organizations wanting to promote events and provide practice access to their instruments.
            </p>
          </div>
        </div>

        <div className="about-principles grid-3">
          <article className="card interactive-card">
            <span className="about-number">01</span>
            <h2>Practice</h2>
            <p>Organizations decide when, how, and under what terms their instruments can be requested.</p>
          </article>

          <article className="card interactive-card">
            <span className="about-number">02</span>
            <h2>Events</h2>
            <p>Concerts, services, workshops, and community programs have a clear public home.</p>
          </article>

          <article className="card interactive-card">
            <span className="about-number">03</span>
            <h2>Trust</h2>
            <p>Completed sessions create verified, useful history for organists and host organizations.</p>
          </article>
        </div>

        <div className="about-band interactive-panel">
          <div>
            <span className="eyebrow">Starting locally</span>
            <h2>Build a useful Greater Boston network first.</h2>
          </div>
          <p>
            The directory combines claimed practice listings, public reference listings, community events, and a path for institutions to verify and take ownership of their information.
          </p>
        </div>
      </div>
    </section>
  );
}
