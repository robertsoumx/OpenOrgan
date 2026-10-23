"use client";

import { useId } from "react";
import { timeZoneLabel } from "@/lib/time-zones.mjs";

const zones = ["America/New_York", "America/Chicago", "America/Denver", "America/Phoenix", "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu", "America/Toronto", "America/Vancouver", "Europe/London", "Europe/Paris", "Asia/Hong_Kong", "Asia/Shanghai", "Asia/Tokyo", "Australia/Sydney", "UTC"];

export default function TimeZoneField({ value, onChange }) {
  const id = useId();
  return <label>Venue time zone<input list={id} value={value} onChange={event => onChange(event.target.value)} required autoComplete="off" spellCheck={false} aria-describedby={id + "-help"}/><datalist id={id}>{zones.map(zone => <option key={zone} value={zone}>{timeZoneLabel(zone)}</option>)}</datalist><span className="small" id={id + "-help"}>{timeZoneLabel(value)}</span></label>;
}
