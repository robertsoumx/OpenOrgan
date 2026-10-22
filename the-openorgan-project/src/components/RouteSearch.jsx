"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/google-maps-client";

export function useRouteRanking(kind, items) {
  const [routes, setRoutes] = useState({});
  const [origin, setOrigin] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const itemsRef = useRef(items), controller = useRef(null), alive = useRef(true), request = useRef(0);
  itemsRef.current = items;
  useEffect(() => { alive.current = true; return () => { alive.current = false; request.current++; controller.current?.abort(); }; }, []);
  const reset = useCallback(() => {
    request.current++; controller.current?.abort();
    setRoutes({}); setOrigin(null); setLoading(false); setNotice("");
  }, []);
  const rank = useCallback(async point => {
    if (!alive.current) return;
    const id = ++request.current;
    controller.current?.abort();
    const current = new AbortController(); controller.current = current;
    setLoading(true); setNotice(""); setRoutes({}); setOrigin(point);
    try {
      const response = await fetch("/api/routes", { method: "POST", headers: { "Content-Type": "application/json" }, signal: current.signal, body: JSON.stringify({ kind, origin: point, ids: itemsRef.current.map(item => item.id) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Driving routes are unavailable; try again or choose another starting place.");
      if (!alive.current || id !== request.current) return;
      const results = Array.isArray(data.results) ? data.results : [];
      setRoutes(Object.fromEntries(results.map(row => [row.id, row])));
      setNotice(!results.length ? "No driving routes were found; choose another starting place." : data.unavailable?.length ? results.length + " destinations ranked; some routes are unavailable." : "Driving routes calculated.");
    } catch (error) {
      if (alive.current && id === request.current && !current.signal.aborted) setNotice(error instanceof TypeError ? "Driving routes are unavailable; check your connection and try again." : error.message || "Driving routes are unavailable; try again.");
    } finally { if (alive.current && id === request.current) setLoading(false); }
  }, [kind]);
  const locate = useCallback(() => {
    if (!navigator.geolocation) { setNotice("Location access is unavailable; choose a starting address."); return; }
    const id = ++request.current; controller.current?.abort();
    setRoutes({}); setOrigin(null); setLoading(true); setNotice("Finding your location...");
    navigator.geolocation.getCurrentPosition(position => {
      if (alive.current && id === request.current) rank({ latitude: position.coords.latitude, longitude: position.coords.longitude, name: "Your location" });
    }, () => {
      if (alive.current && id === request.current) { setLoading(false); setNotice("Location access is unavailable; choose a starting address."); }
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  }, [rank]);
  return { routes, origin, loading, notice, rank, locate, reset, ready: Object.keys(routes).length > 0 };
}

function StartingPlace({ onSelect }) {
  const node = useRef(null), callback = useRef(onSelect);
  callback.current = onSelect;
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false, element, handler;
    (async () => {
      try {
        const maps = await loadGoogleMaps(), places = await maps.importLibrary("places");
        if (cancelled) return;
        element = new places.PlaceAutocompleteElement();
        element.placeholder = "Enter a starting address or place";
        element.setAttribute("aria-label", "Starting address");
        handler = async event => {
          try {
            const place = event.placePrediction?.toPlace();
            if (!place) return;
            await place.fetchFields({ fields: ["location", "displayName", "formattedAddress"] });
            if (cancelled || !place.location) return;
            setError("");
            callback.current({ latitude: place.location.lat(), longitude: place.location.lng(), name: place.displayName || place.formattedAddress });
          } catch { if (!cancelled) setError("Select a specific place from the search results."); }
        };
        element.addEventListener("gmp-select", handler); node.current?.appendChild(element);
      } catch { if (!cancelled) setError("Address search is unavailable; try using your location."); }
    })();
    return () => { cancelled = true; if (element && handler) element.removeEventListener("gmp-select", handler); element?.remove(); };
  }, []);
  return <div className="starting-place"><div ref={node}/>{error && <p role="alert">{error}</p>}</div>;
}

export default function RouteSearch({ ranking }) {
  const [addressOpen, setAddressOpen] = useState(false);
  return <details className="route-search">
    <summary>Nearest by route{ranking.loading ? " · Calculating" : ranking.ready ? " · Active" : ""}</summary>
    <div className="route-search-body">
      <div className="route-search-actions">
        <button type="button" className="button-secondary" disabled={ranking.loading} onClick={ranking.locate}>{ranking.loading ? "Calculating..." : "Use my location"}</button>
        <button type="button" className="button-secondary" disabled={ranking.loading} aria-expanded={addressOpen} onClick={() => setAddressOpen(!addressOpen)}>{addressOpen ? "Hide address search" : "Choose starting address"}</button>
        {(ranking.origin || ranking.notice) && <button type="button" className="button-ghost" onClick={event => { const summary = event.currentTarget.closest("details")?.querySelector("summary"); ranking.reset(); setAddressOpen(false); summary?.focus(); }}>Clear starting place</button>}
      </div>
      {addressOpen && <StartingPlace onSelect={ranking.rank}/>}
      <p className="small route-status" role="status" aria-live="polite">{ranking.notice || "Choose a starting place to compare driving distances."}{ranking.origin?.name ? " From: " + ranking.origin.name : ""}</p>
    </div>
  </details>;
}
