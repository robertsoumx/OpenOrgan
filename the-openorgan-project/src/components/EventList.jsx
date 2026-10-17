"use client";
import { useEffect, useMemo, useState } from "react";
import RouteSearch,{useRouteRanking} from "@/components/RouteSearch";
import EventCard from "@/components/EventCard";
import { eventDate } from "@/lib/events-core.mjs";
export default function EventList({ initialEvents=[], sources=[], generatedAt }) {
  const [period,setPeriod]=useState("upcoming"),[search,setSearch]=useState(""),[venue,setVenue]=useState("");
  const ranking=useRouteRanking("events",initialEvents);
  const [order,setOrder]=useState("date");
  const now = new Date(generatedAt).getTime();
  useEffect(()=>{if(ranking.ready)setOrder("distance");},[ranking.ready,ranking.origin]);
  const venues=useMemo(()=>[...new Set(initialEvents.map(e=>e.location?.name || e.organizationName).filter(Boolean))].sort(),[initialEvents]);
  const filtered=useMemo(()=>initialEvents.filter(event=>{
    const date=new Date(event.endDateTime || event.startDateTime).getTime();
    const text=[event.title,event.performer,event.description,event.organizationName,event.location?.name,event.location?.city,event.location?.formattedAddress].join(" ").toLowerCase();
    return (period === "upcoming" ? date >= now : date < now) && text.includes(search.trim().toLowerCase()) && (!venue || (event.location?.name || event.organizationName)===venue);
  }).map(event=>({...event,...ranking.routes[event.id]})).sort((a,b)=>order === "distance" && ranking.ready ? (a.routeDistanceMeters??Infinity)-(b.routeDistanceMeters??Infinity) || new Date(a.startDateTime)-new Date(b.startDateTime) : period === "recent" ? new Date(b.startDateTime)-new Date(a.startDateTime) : new Date(a.startDateTime)-new Date(b.startDateTime)),[initialEvents,now,period,search,venue,order,ranking.routes,ranking.ready]);
  function clear(){setSearch("");setVenue("");}
  return <section className="section"><div className="container">
    <header className="page-header editorial-header"><h1>Find events</h1><p>Browse recitals, concerts, and workshops by date, venue, or driving route.</p></header>
    <div className="segmented" aria-label="Event period">{["upcoming","recent"].map(value=><button key={value} type="button" className={value===period?"active":""} aria-pressed={value===period} onClick={()=>setPeriod(value)}>{value === "upcoming" ? "Upcoming" : "Recent"}</button>)}</div>
    <div className="event-filter-fields"><label>Search events<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Performer, venue, city, or address" type="search" /></label><label>Venue<select value={venue} onChange={e=>setVenue(e.target.value)}><option value="">All venues</option>{venues.map(name=><option key={name}>{name}</option>)}</select></label></div>
    <RouteSearch ranking={ranking}/><label className="event-order">Order events<select value={order} onChange={e=>setOrder(e.target.value)}><option value="date">Date</option><option value="distance" disabled={!ranking.ready}>Nearest by driving route</option></select></label>
    <div className="flex-between"><p role="status" aria-live="polite">{filtered.length} {filtered.length===1 ? "event" : "events"}</p>{(search || venue) && <button className="button-secondary" onClick={clear}>Clear filters</button>}</div>
    {filtered.length ? <div className="grid-3">{filtered.map(event=><EventCard key={event.id} event={event} recent={period === "recent"} />)}</div> : <div className="empty-state"><h2>No matching events</h2><p>{search || venue ? "Clear a filter or try another place." : "Check the other date period for published events."}</p><button className="button-secondary" onClick={()=>{clear();setPeriod(period === "upcoming" ? "recent" : "upcoming");}}>View {period === "upcoming" ? "recent" : "upcoming"} events</button></div>}
    <details className="source-health"><summary>Calendar sources and update status</summary><ul>{sources.map(source=><li key={source.sourceId}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.name || source.sourceId}</a>{source.checkedAt ? ` · Last verified ${eventDate(source.checkedAt)}` : " · No verified dates available"}{!source.ok && " · Source unavailable; cached dates expire after 30 days"}</li>)}</ul><p>Confirm schedule and ticket details with the organizer.</p></details>
  </div></section>;
}
