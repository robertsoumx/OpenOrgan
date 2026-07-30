"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase-client";
import { toDate } from "@/lib/format";

export default function HomeHighlights() {
  const [events, setEvents] = useState([]);
  useEffect(() => {
    if (!db) return;
    getDocs(query(collection(db, "events"), where("status", "==", "active"))).then((snap) => setEvents(snap.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a,b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0)).slice(0,3))).catch(() => {});
  }, []);
  return <section className="section home-events"><div className="container"><div className="flex-between"><div><span className="eyebrow">Recently posted</span><h2>Events</h2></div><Link href="/events">See all</Link></div><div className="grid-3">{events.length ? events.map((event) => <Link className="card event-card" key={event.id} href={`/events/${event.id}`}><span className="badge">{event.type || "Event"}</span><h3>{event.title}</h3><p>{event.organizationName}</p></Link>) : <article className="card"><h3>Events will appear here</h3><p className="muted">Organizations can publish after verification.</p></article>}</div></div></section>;
}
