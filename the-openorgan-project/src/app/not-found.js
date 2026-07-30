import Link from "next/link";
export default function NotFound() { return <section className="section"><div className="container empty-state"><h1>Page not found</h1><p>The page may have moved or no longer exists.</p><Link className="button" href="/">Return Home</Link></div></section>; }
