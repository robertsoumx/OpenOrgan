"use client";
import { useMemo, useState } from "react";
export default function LocationPanel({ location }) {
  const [open, setOpen] = useState(false);
  const src = useMemo(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key || !location?.placeId) return "";
    return `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(key)}&q=${encodeURIComponent(`place_id:${location.placeId}`)}`;
  }, [location?.placeId]);
  if (!location?.placeId) return null;
  return <section className="card location-panel"><div className="flex-between"><div><span className="eyebrow">Location</span><h2>{location.name}</h2><p>{location.formattedAddress}</p></div><button className="button-secondary" onClick={() => setOpen(!open)}>{open ? "Hide Map" : "Show Map"}</button></div>{open && <div className="map-reveal">{src && <iframe title={`Map of ${location.name}`} src={src} loading="lazy" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />}{location.googleMapsUri && <a className="button" target="_blank" rel="noreferrer" href={location.googleMapsUri}>Open in Google Maps</a>}</div>}</section>;
}
