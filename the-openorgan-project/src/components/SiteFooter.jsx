import {KeyboardRule,PipeMark} from "@/components/OrganMotifs";
import Link from "next/link";
export default function SiteFooter() {
  return <footer className="site-footer"><KeyboardRule/><div className="container">
    <div className="footer-grid"><div><PipeMark className="footer-pipe-mark"/><h2>The OpenOrgan Project</h2><p>Find organs and events, offer practice access, and publish upcoming events.</p></div><nav aria-label="Explore OpenOrgan"><strong>Explore</strong><Link href="/search">Find organs</Link><Link href="/events">Find events</Link><Link href="/about">About</Link></nav><nav aria-label="Participate in OpenOrgan"><strong>Get involved</strong><Link href="/register?role=organization">Offer access or publish events</Link><Link href="/guide">User guide</Link><Link href="/register">Create an account</Link><Link href="/login">Sign in</Link><a href="https://pipeorgandatabase.org" target="_blank" rel="noopener noreferrer">Pipe Organ Database</a></nav></div>
    <div className="footer-bottom"><p>Copyright {new Date().getFullYear()} OpenOrgan</p><span>Source listings do not imply permission to practice.</span></div>
  </div></footer>;
}
