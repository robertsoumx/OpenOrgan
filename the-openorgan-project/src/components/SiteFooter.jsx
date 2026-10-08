import Link from "next/link";
export default function SiteFooter() {
  return <footer className="site-footer"><div className="container">
    <div className="footer-grid"><div><h2>The OpenOrgan Project</h2><p>A local network for remarkable instruments, public music, and practice access. Beginning in Greater Boston.</p></div><nav aria-label="Explore OpenOrgan"><strong>Explore</strong><Link href="/search">Church organ directory</Link><Link href="/events">Concerts and recitals</Link><Link href="/about">Our mission</Link></nav><nav aria-label="Participate in OpenOrgan"><strong>Take part</strong><Link href="/register">Join as an organist or host</Link><Link href="/login">Sign in</Link><a href="https://pipeorgandatabase.org" target="_blank" rel="noopener noreferrer">Pipe Organ Database</a></nav></div>
    <div className="footer-bottom"><p>Copyright {new Date().getFullYear()} OpenOrgan</p><span>Source listings do not imply permission to practice.</span></div>
  </div></footer>;
}
