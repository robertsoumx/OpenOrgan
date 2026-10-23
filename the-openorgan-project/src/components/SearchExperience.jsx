"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase-client";
import OrganCard from "@/components/OrganCard";
import RouteSearch, { useRouteRanking } from "@/components/RouteSearch";
import { browseOrgans } from "@/lib/organ-browse.mjs";
import { coordinates } from "@/lib/directory-core.mjs";

const SearchMap = dynamic(() => import("@/components/SearchMap"), { ssr: false, loading: () => <div className="skeleton map-shell"/> });
const PAGE_SIZE = 20;

export default function SearchExperience({ initialOrgans = [] }) {
  const [organs, setOrgans] = useState(initialOrgans), [loading, setLoading] = useState(!initialOrgans.length), [notice, setNotice] = useState("");
  const [search, setSearch] = useState(""), [sort, setSort] = useState("claimed"), [limit, setLimit] = useState(PAGE_SIZE);
  const [listingStatus, setListingStatus] = useState("all"), [availability, setAvailability] = useState("all"), [selectedId, setSelectedId] = useState(""), [view, setView] = useState("list");
  const [mapEnabled, setMapEnabled] = useState(false);
  const [reviews, setReviews] = useState({});
  const mapPanel = useRef(null), listPanel = useRef(null);
  const ranking = useRouteRanking("organs", organs);

  useEffect(() => {
    const readQuery = () => {
      const params = new URLSearchParams(window.location.search);
      setSearch(params.get("q") || "");
      setListingStatus(["claimed", "unclaimed", "pending"].includes(params.get("status")) ? params.get("status") : "all");
      setAvailability(["accepting", "unavailable"].includes(params.get("access")) ? params.get("access") : "all");
      setLimit(PAGE_SIZE);
    };
    readQuery(); window.addEventListener("popstate", readQuery);
    return () => window.removeEventListener("popstate", readQuery);
  }, []);
  function updateFilters(changes) {
    if ("q" in changes) setSearch(changes.q);
    if ("status" in changes) setListingStatus(changes.status);
    if ("access" in changes) setAvailability(changes.access);
    setLimit(PAGE_SIZE);
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(changes)) {
      if (value && value !== "all") url.searchParams.set(key, value); else url.searchParams.delete(key);
    }
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }

  useEffect(() => {
    const screen = window.matchMedia("(min-width: 1041px)");
    const enable = () => { if (screen.matches) setMapEnabled(true); };
    enable(); screen.addEventListener("change", enable);
    return () => screen.removeEventListener("change", enable);
  }, []);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/directory").then(response => { if (!response.ok) throw new Error(); return response.json(); }).then(data => {
      if (!Array.isArray(data.organs)) throw new Error();
      if (!cancelled) setOrgans(data.organs);
    }).catch(() => { if (!cancelled) setNotice(initialOrgans.length ? "Showing the last loaded directory while updates are unavailable." : "The directory is temporarily unavailable; reload to try again."); }).finally(() => { if (!cancelled) setLoading(false); });
    if (db) getDocs(collection(db, "organReviews")).then(snapshot => {
      if (cancelled) return;
      const grouped = {};
      snapshot.docs.forEach(doc => {
        const review = doc.data(), rating = Number(review.rating);
        if (Number.isFinite(rating) && rating >= 1 && rating <= 5) (grouped[review.organId] ||= []).push(rating);
      });
      setReviews(Object.fromEntries(Object.entries(grouped).map(([id, values]) => [id, { ratingAverage: values.reduce((sum, value) => sum + value, 0) / values.length, ratingCount: values.length }])));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  const filtered = useMemo(() => browseOrgans(organs, { search, listingStatus, availability, sort, reviews, routes: ranking.routes, routeReady: ranking.ready }), [organs, search, listingStatus, availability, sort, reviews, ranking.routes, ranking.ready]);
  useEffect(() => { if (ranking.ready) setSort("distance"); else setSort(current => current === "distance" ? "claimed" : current); }, [ranking.ready, ranking.origin]);
  const displayed = filtered.slice(0, limit);
  const mapped = useMemo(() => filtered.filter(organ => coordinates(organ.location)), [filtered]);
  const selectFromMap = useCallback(id => {
    setSelectedId(id);
    const index = filtered.findIndex(organ => organ.id === id);
    setLimit(current => Math.max(current, Math.ceil((index + 1) / PAGE_SIZE) * PAGE_SIZE));
    setView("list");
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const card = document.getElementById("organ-card-" + id);
      card?.focus({ preventScroll: true });
      card?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    }));
  }, [filtered]);
  function switchView(next) {
    setView(next); if (next === "map") setMapEnabled(true);
    requestAnimationFrame(() => (next === "map" ? mapPanel : listPanel).current?.focus({ preventScroll: true }));
  }
  function clear() { updateFilters({ q: "", status: "all", access: "all" }); setSelectedId(""); }
  const hasFilters = Boolean(search || listingStatus !== "all" || availability !== "all");

  return <div className="search-layout">
    <section className="search-list-panel">
      <header className="page-header compact directory-heading"><h1>Find organs</h1><p>Compare instruments, locations, practice costs, and availability.</p></header>
      <div className="search-toolbar">
        <input type="search" aria-label="Search organs" placeholder="Church, city, address, or builder" value={search} onChange={event => updateFilters({ q: event.target.value })}/>
        <select aria-label="Order organs" value={sort} onChange={event => setSort(event.target.value)}><option value="claimed">Claimed first</option><option value="name">Name</option><option value="distance" disabled={!ranking.ready}>Nearest by driving route</option><option value="rating">Highest rated</option><option value="newest">Newest listing</option></select>
      </div>
      <div className="browse-status-filters"><label>Listing status<select value={listingStatus} onChange={event => updateFilters({ status: event.target.value })}><option value="all">All listings</option><option value="claimed">Claimed by institution</option><option value="unclaimed">Unclaimed reference</option><option value="pending">Claim pending</option></select></label><label>Practice access<select value={availability} onChange={event => updateFilters({ access: event.target.value })}><option value="all">Any availability</option><option value="accepting">Accepts requests</option><option value="unavailable">Requests unavailable</option></select></label></div><div className="browse-tools"><RouteSearch ranking={ranking}/></div>
      <div className="browse-results-header"><p role="status" aria-live="polite">{filtered.length} {filtered.length === 1 ? "organ" : "organs"}{displayed.length < filtered.length ? " · " + displayed.length + " shown" : ""}</p>{hasFilters && <button type="button" className="button-ghost" onClick={clear}>Clear filters</button>}</div>
      <div className="mobile-view-toggle" aria-label="Directory view"><button className={view === "list" ? "button" : "button-secondary"} aria-pressed={view === "list"} onClick={() => switchView("list")}>List</button><button className={view === "map" ? "button" : "button-secondary"} aria-pressed={view === "map"} onClick={() => switchView("map")}>Map</button></div>
      {notice && <div className="message warning" role="status">{notice}</div>}
      <div ref={listPanel} role="region" tabIndex={-1} className={"directory-list-content " + (view === "map" ? "mobile-hidden" : "")} aria-label="Organ results" aria-busy={loading}>
        {loading ? <div className="stack"><div className="skeleton"/><div className="skeleton"/></div> : displayed.length ? <div className="search-results">{displayed.map(organ => <OrganCard key={organ.id} organ={organ} selected={selectedId === organ.id} onHover={setSelectedId}/>)}</div> : <div className="empty-state"><h2>{availability === "accepting" ? "No matching organs accept practice requests" : "No organs found"}</h2><p>{"Try another place, listing status, or availability filter."}</p><button className="button-secondary" onClick={clear}>Clear filters</button></div>}
        {displayed.length < filtered.length && <button className="button-secondary load-results" onClick={() => setLimit(current => current + PAGE_SIZE)}>Show {Math.min(PAGE_SIZE, filtered.length - displayed.length)} more organs</button>}
      </div>
    </section>
    <aside ref={mapPanel} tabIndex={-1} aria-label="Organ map" className={"search-map-panel " + (view === "list" ? "mobile-hidden" : "")}>
      {mapEnabled && <SearchMap organs={mapped} selectedId={selectedId} onSelect={selectFromMap} userLocation={ranking.origin ? { lat: ranking.origin.latitude, lng: ranking.origin.longitude } : null}/>}
    </aside>
  </div>;
}
