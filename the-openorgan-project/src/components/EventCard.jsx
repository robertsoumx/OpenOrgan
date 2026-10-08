"use client";
import Link from "next/link";
import { useState } from "react";
import { eventDate, safeImage } from "@/lib/events-core.mjs";
export default function EventCard({ event, recent = false }) {
  const [image, setImage] = useState(safeImage(event.imageUrl));
  return <Link className="card event-card" href={"/events/" + event.id}>
    <div className="event-thumbnail"><img src={image} alt={event.imageAlt || event.title} loading="lazy" width="640" height="360" onError={() => setImage("/event-cover.svg")} /><span className="event-date-tile"><strong>{eventDate(event.startDateTime, { day: "2-digit", month: undefined, year: undefined })}</strong>{eventDate(event.startDateTime, { month: "short", day: undefined, year: undefined })}</span></div>
    <div className="event-card-body"><span className="eyebrow">{recent ? "Recently held" : event.type || "Organ event"}</span><h2>{event.title}</h2><p>{eventDate(event.startDateTime, { weekday: "short", hour: "numeric", minute: "2-digit" })} ET</p><p className="muted">{event.organizationName} · {event.location?.city}</p><div className="event-card-meta"><span>{event.admission || "See event details"}</span><span className="text-link">View event</span></div></div>
  </Link>;
}
