"use client";
import { useId, useState } from "react";
import { mapUrl } from "@/lib/events-core.mjs";
export default function LocationPanel({ location }) {
  const [open,setOpen]=useState(false), [message,setMessage]=useState("");
  const id=useId();
  if (!location?.formattedAddress && !location?.placeId) return null;
  const query=location.placeId ? `place_id:${location.placeId}` : [location.name,location.formattedAddress].filter(Boolean).join(", ");
  const key=process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const src=key ? `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(key)}&q=${encodeURIComponent(query)}` : `https://maps.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
  async function copyAddress() {
    try { await navigator.clipboard.writeText(location.formattedAddress); setMessage("Address copied."); }
    catch { setMessage("Select the address above to copy it."); }
  }
  return <section className="card location-panel" aria-labelledby={`${id}-title`}><span className="eyebrow">Location</span><h2 id={`${id}-title`}>{location.name || "Event venue"}</h2><address className="location-address">{location.formattedAddress}</address>
    <div className="location-actions"><a className="button" target="_blank" rel="noopener noreferrer" href={mapUrl(location,true)}>Get directions</a><button className="button-secondary" aria-expanded={open} aria-controls={`${id}-map`} onClick={()=>setOpen(!open)}>{open ? "Hide map" : "Show map"}</button>{location.formattedAddress && <button className="button-secondary" onClick={copyAddress}>Copy address</button>}</div>
    <p className="small" role="status">{message}</p>
    {open && <div className="map-reveal" id={`${id}-map`}><iframe title={`Map of ${location.name || location.formattedAddress}`} src={src} loading="lazy" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /><a target="_blank" rel="noopener noreferrer" href={mapUrl(location)}>Open in Google Maps</a></div>}
  </section>;
}
