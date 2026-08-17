"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase-client";
import { formatDateTime, toDate } from "@/lib/format";
import { toUserMessage } from "@/lib/user-error";

export default function EventList() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState("newest");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }

    getDocs(query(collection(db, "events"), where("status", "==", "active")))
      .then((snap) => setEvents(snap.docs.map((item) => ({ id: item.id, ...item.data() }))))
      .catch((error) => setMessage(toUserMessage(error, "Unable to load events.")))
      .finally(() => setLoading(false));
  }, []);

  const sorted = useMemo(() => [...events].sort((a, b) => {
    const left = toDate(a.startDateTime)?.getTime() || 0;
    const right = toDate(b.startDateTime)?.getTime() || 0;
    return order === "oldest" ? left - right : right - left;
  }), [events, order]);

  return (
    <section className="section">
      <div className="container">
        <div className="page-header">
          <span className="eyebrow">Public music</span>
          <h1>Events</h1>
          <p>Concerts, services, workshops, and other organ events.</p>
        </div>

        <div className="search-toolbar event-order">
          <span />
          <select value={order} onChange={(event) => setOrder(event.target.value)} aria-label="Order events">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>

        {message && <div className="message error">{message}</div>}

        {loading ? (
          <div className="skeleton" />
        ) : sorted.length ? (
          <div className="grid-3">
            {sorted.map((event) => (
              <Link className="card event-card" href={`/events/${event.id}`} key={event.id}>
                {event.imageUrl && <img src={event.imageUrl} alt="" />}
                <span className="badge">{event.type || "Event"}</span>
                <h2>{event.title}</h2>
                <p>{formatDateTime(event.startDateTime)}</p>
                <p className="muted">{event.organizationName}{event.location?.city ? ` · ${event.location.city}` : ""}</p>
                {event.registrationPolicy === "required" && <strong>Signup required</strong>}
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state events-empty-state">
            <span className="eyebrow">Nothing scheduled</span>
            <h2>No public events yet</h2>
            <p>When participating organizations publish an event, it will appear here.</p>
            <Link className="button-secondary" href="/search">Explore organs</Link>
          </div>
        )}
      </div>
    </section>
  );
}
