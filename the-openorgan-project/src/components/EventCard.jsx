"use client";
import Link from "next/link";
import { useState } from "react";
import { eventDate, safeImage } from "@/lib/events-core.mjs";

export default function EventCard({ event, recent = false, headingLevel = 2 }) {
  const [image, setImage] = useState(safeImage(event.imageUrl));
  const Heading = headingLevel === 3 ? "h3" : "h2";
  return <Link className="event-card" href={"/events/" + event.id}>
    <div className="event-thumbnail">
      <img src={image} alt={event.imageAlt || ""} loading="lazy" width="640" height="360" onError={() => setImage("/event-cover.svg")}/>
      <time className="event-date-tile" dateTime={event.startDateTime} aria-label={eventDate(event.startDateTime)}>
        <strong>{eventDate(event.startDateTime, { day: "2-digit", month: undefined, year: undefined })}</strong>
        {eventDate(event.startDateTime, { month: "short", day: undefined, year: undefined })}
      </time>
    </div>
    <div className="event-card-body">
      <Heading>{event.title}</Heading>
      <p className="event-schedule">{recent ? "Recently held · " : ""}{eventDate(event.startDateTime, { weekday: "short", month: undefined, day: undefined, year: undefined, hour: "numeric", minute: "2-digit" })} ET · {eventDate(event.startDateTime, { year: "numeric", month: undefined, day: undefined })}</p>
      <p className="event-venue">{event.location?.name || event.organizationName}</p>
      <p className="event-address">{event.location?.formattedAddress}</p>
      {Number.isFinite(event.routeDistanceMeters) && <p className="route-distance">{(event.routeDistanceMeters / 1609.344).toFixed(1)} mi · {Math.round(event.routeDurationSeconds / 60)} min driving</p>}
      <div className="event-card-meta"><span>{event.admission || "See admission details"}</span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11m-5-5 5 5-5 5"/></svg></div>
    </div>
  </Link>;
}
