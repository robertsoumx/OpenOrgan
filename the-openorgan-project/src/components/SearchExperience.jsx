"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase-client";
import OrganCard from "@/components/OrganCard";
import { toDate } from "@/lib/format";
import { apiMessage, toUserMessage, userError } from "@/lib/user-error";
import { trackEvent } from "@/lib/analytics-client";

const SearchMap = dynamic(() => import("@/components/SearchMap"), {
  ssr: false,
  loading: () => <div className="skeleton map-shell" />
});

const LIMIT_OPTIONS = [5, 10, 20, 50];

function price(organ) {
  return organ.pricing?.model === "free" ? 0 : Number(organ.pricing?.amountCents || 0);
}

function recommendationScore(organ, hasRoutes) {
  const rating = Number(organ.ratingAverage || 0) / 5;
  const cost = 1 - Math.min(price(organ) / 10000, 1);
  const reliability = Number(organ.providerReliability || 0.8);
  const distance = hasRoutes && Number.isFinite(organ.routeDistanceMeters)
    ? 1 - Math.min(organ.routeDistanceMeters / 80467.2, 1)
    : null;

  if (distance == null) return rating * 0.643 + cost * 0.286 + reliability * 0.071;
  return rating * 0.45 + distance * 0.3 + cost * 0.2 + reliability * 0.05;
}

export default function SearchExperience() {
  const [organs, setOrgans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState({ type: "", text: "" });
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("distance");
  const [limit, setLimit] = useState(5);
  const [selectedId, setSelectedId] = useState("");
  const [view, setView] = useState("list");
  const [routing, setRouting] = useState(false);
  const [locationPhase, setLocationPhase] = useState("idle");
  const [userLocation, setUserLocation] = useState(null);
  const automaticLocationAttempted = useRef(false);

  const selectFromMap = useCallback((id) => {
    setSelectedId(id);
    trackEvent("directory_map_select", {
      feature: "organ_directory",
      action: "select_marker",
      targetType: "organ",
      targetId: id
    });
    document.getElementById(`organ-card-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  useEffect(() => {
    if (!db) {
      setLoading(false);
      setNotice({ type: "error", text: "The organ directory is temporarily unavailable." });
      return;
    }

    Promise.all([
      getDocs(query(collection(db, "organs"), where("status", "==", "active"))),
      getDocs(collection(db, "organReviews"))
    ])
      .then(([organSnapshot, reviewSnapshot]) => {
        const grouped = new Map();
        reviewSnapshot.docs.forEach((item) => {
          const review = item.data();
          if (!grouped.has(review.organId)) grouped.set(review.organId, []);
          grouped.get(review.organId).push(Number(review.rating || 0));
        });

        setOrgans(organSnapshot.docs.map((item) => {
          const data = item.data();
          const ratings = grouped.get(item.id) || [];
          return {
            id: item.id,
            ...data,
            ratingAverage: ratings.length
              ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length
              : 0,
            ratingCount: ratings.length
          };
        }));
      })
      .catch((error) => {
        setNotice({ type: "error", text: toUserMessage(error, "We could not load the organ directory. Try again.") });
      })
      .finally(() => setLoading(false));
  }, []);

  const requestLocation = useCallback((automatic = false) => {
    if (!navigator.geolocation) {
      setLocationPhase("unavailable");
      setSort("recommended");
      trackEvent("directory_location", {
        feature: "organ_directory",
        action: automatic ? "automatic" : "manual",
        outcome: "unsupported",
        locationStatus: "unavailable"
      });
      if (!automatic) setNotice({ type: "error", text: "This browser cannot share a location for distance ranking." });
      return;
    }

    setRouting(true);
    setLocationPhase("requesting");
    if (!automatic) setNotice({ type: "", text: "" });

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const origin = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        setUserLocation({ lat: origin.latitude, lng: origin.longitude });

        try {
          const destinations = organs
            .filter((organ) => organ.location?.placeId)
            .map((organ) => ({ id: organ.id, placeId: organ.location.placeId }));

          if (!destinations.length) throw userError("No mapped organ locations are available yet.");

          const response = await fetch("/api/routes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ origin, destinations })
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw userError(apiMessage(data, response.status, "We could not calculate route distances."));

          const results = new Map(data.results.map((result) => [result.id, result]));
          setOrgans((current) => current.map((organ) => ({ ...organ, ...results.get(organ.id) })));
          setSort("distance");
          setLocationPhase("ready");
          setNotice({ type: "", text: "" });
          trackEvent("directory_location", {
            feature: "organ_directory",
            action: automatic ? "automatic" : "manual",
            outcome: "success",
            locationStatus: "ready",
            resultCount: data.results?.length || 0
          });
        } catch (error) {
          setLocationPhase("route-error");
          setSort("recommended");
          setNotice({
            type: "error",
            text: toUserMessage(error, "We found your location but could not calculate routes. Showing recommended organs instead.")
          });
          trackEvent("directory_location", {
            feature: "organ_directory",
            action: automatic ? "automatic" : "manual",
            outcome: "route_error",
            locationStatus: "route-error"
          });
        } finally {
          setRouting(false);
        }
      },
      (error) => {
        setRouting(false);
        const denied = error?.code === 1;
        setLocationPhase(denied ? "denied" : "unavailable");
        setSort("recommended");
        setNotice({
          type: "info",
          text: denied
            ? "Location access is off. Showing recommended organs instead. You can enable location at any time."
            : "Your location could not be read. Showing recommended organs instead."
        });
        trackEvent("directory_location", {
          feature: "organ_directory",
          action: automatic ? "automatic" : "manual",
          outcome: denied ? "denied" : "unavailable",
          locationStatus: denied ? "denied" : "unavailable"
        });
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }, [organs]);

  useEffect(() => {
    if (loading || !organs.length || automaticLocationAttempted.current) return;
    automaticLocationAttempted.current = true;

    let cancelled = false;
    async function startAutomaticLocation() {
      try {
        if (navigator.permissions?.query) {
          const permission = await navigator.permissions.query({ name: "geolocation" });
          if (cancelled) return;
          if (permission.state === "denied") {
            setLocationPhase("denied");
            setSort("recommended");
            setNotice({ type: "info", text: "Location access is off. Showing recommended organs instead." });
            trackEvent("directory_location", {
              feature: "organ_directory",
              action: "automatic",
              outcome: "already_denied",
              locationStatus: "denied"
            });
            return;
          }
        }
      } catch {
        // Safari and some browsers do not expose geolocation through Permissions API.
      }
      if (!cancelled) requestLocation(true);
    }

    startAutomaticLocation();
    return () => { cancelled = true; };
  }, [loading, organs.length, requestLocation]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const hasRoutes = organs.some((organ) => Number.isFinite(organ.routeDistanceMeters));
    const items = organs.filter((organ) => {
      if (!term) return true;
      return [
        organ.name,
        organ.organizationName,
        organ.builder,
        organ.location?.city,
        organ.location?.region
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });

    items.sort((a, b) => {
      if (sort === "newest") return (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0);
      if (sort === "distance") return (a.routeDistanceMeters ?? Infinity) - (b.routeDistanceMeters ?? Infinity);
      if (sort === "rating") return (b.ratingAverage || 0) - (a.ratingAverage || 0);
      if (sort === "price") return price(a) - price(b);
      return recommendationScore(b, hasRoutes) - recommendationScore(a, hasRoutes);
    });

    return items;
  }, [organs, search, sort]);

  const displayed = useMemo(
    () => limit === "all" ? filtered : filtered.slice(0, Number(limit)),
    [filtered, limit]
  );

  const hasRoutes = organs.some((organ) => Number.isFinite(organ.routeDistanceMeters));
  const findingNearest = !loading && organs.length > 0 && locationPhase === "requesting" && !hasRoutes;
  const locationButtonNeeded = ["denied", "unavailable", "route-error"].includes(locationPhase);

  function changeSort(value) {
    setSort(value);
    trackEvent("directory_sort", { feature: "organ_directory", sort: value, resultCount: filtered.length });
  }

  function changeLimit(value) {
    const next = value === "all" ? "all" : Number(value);
    setLimit(next);
    trackEvent("directory_limit", { feature: "organ_directory", limit: String(next), resultCount: filtered.length });
  }

  function finishSearch() {
    if (!search.trim()) return;
    trackEvent("directory_search", {
      feature: "organ_directory",
      queryLength: search.trim().length,
      resultCount: filtered.length
    });
  }

  return (
    <div className="search-layout">
      <section className={`search-list-panel ${view === "map" ? "mobile-hidden" : ""}`}>
        <div className="page-header compact directory-heading">
          <span className="eyebrow">Greater Boston church organs</span>
          <h1>Find organs</h1>
          <p>Church organs sourced from the Pipe Organ Database, plus claimed practice listings from participating organizations.</p>
        </div>

        <div className="mobile-view-toggle">
          <button className="button" onClick={() => { setView("list"); trackEvent("directory_view", { feature: "organ_directory", action: "list" }); }}>List</button>
          <button className="button-secondary" onClick={() => { setView("map"); trackEvent("directory_view", { feature: "organ_directory", action: "map" }); }}>Map</button>
        </div>

        <div className="search-toolbar search-toolbar-extended">
          <input
            aria-label="Search organs"
            placeholder="Church, city, builder..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onBlur={finishSearch}
            onKeyDown={(event) => { if (event.key === "Enter") finishSearch(); }}
          />

          <select aria-label="Order organs" value={sort} onChange={(event) => changeSort(event.target.value)}>
            <option value="distance">Nearest by route</option>
            <option value="recommended">Recommended</option>
            <option value="rating">Highest rated</option>
            <option value="price">Lowest cost</option>
            <option value="newest">Newest listing</option>
          </select>

          <select aria-label="Number of organs to show" value={limit} onChange={(event) => changeLimit(event.target.value)}>
            {LIMIT_OPTIONS.map((value) => <option key={value} value={value}>Show {value}</option>)}
            <option value="all">Show all</option>
          </select>
        </div>

        <div className="search-status-row">
          <span className="directory-location-status" aria-live="polite">
            <span className={`location-dot ${locationPhase}`} aria-hidden="true" />
            {findingNearest
              ? "Finding the nearest church organs…"
              : hasRoutes
                ? "Using your current location"
                : "Location-based ranking unavailable"}
          </span>

          {locationButtonNeeded && (
            <button className="button-ghost location-retry" onClick={() => requestLocation(false)} disabled={routing}>
              {routing ? "Checking…" : "Enable location"}
            </button>
          )}

          <span className="muted small">Showing {displayed.length} of {filtered.length} matching organ{filtered.length === 1 ? "" : "s"}.</span>
        </div>

        {notice.text && <div className={`message ${notice.type}`} role={notice.type === "error" ? "alert" : "status"}>{notice.text}</div>}

        {loading || findingNearest ? (
          <div className="stack search-results"><div className="skeleton" /><div className="skeleton short" /></div>
        ) : displayed.length ? (
          <div className="stack search-results">
            {displayed.map((organ) => (
              <OrganCard key={organ.id} organ={organ} selected={selectedId === organ.id} onHover={setSelectedId} />
            ))}
          </div>
        ) : (
          <div className="empty-state"><h2>No organs found</h2></div>
        )}
      </section>

      <aside className={`search-map-panel ${view === "list" ? "mobile-hidden" : ""}`}>
        <div className="mobile-view-toggle">
          <button className="button-secondary" onClick={() => setView("list")}>List</button>
          <button className="button" onClick={() => setView("map")}>Map</button>
        </div>
        <SearchMap organs={displayed} selectedId={selectedId} onSelect={selectFromMap} userLocation={userLocation} />
      </aside>
    </div>
  );
}
