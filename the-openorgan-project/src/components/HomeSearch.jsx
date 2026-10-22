"use client";

import Link from "next/link";

export default function HomeSearch({ secondary = ["/events", "Find events"] }) {
  return <div className="home-discovery">
    <form action="/search" method="get" className="home-search" role="search" aria-label="Find an organ">
      <label htmlFor="home-organ-query">Church, city, address, or builder</label>
      <div className="home-search-field">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>
        <input id="home-organ-query" type="search" name="q" placeholder="Where would you like to play?" autoComplete="off"/>
        <button className="button" type="submit">Find organs<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg></button>
      </div>
    </form>
    <div className="home-search-links"><div className="home-places"><span>Explore</span>{["Boston", "Cambridge", "Salem"].map(city => <Link key={city} href={"/search?q=" + city}>{city}</Link>)}</div><Link className="text-link" href={secondary[0]}>{secondary[1]}<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 10h13m-5-5 5 5-5 5"/></svg></Link></div>
  </div>;
}
