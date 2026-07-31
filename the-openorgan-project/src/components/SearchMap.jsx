"use client";

import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/google-maps-client";
import { toUserMessage } from "@/lib/user-error";

const CENTER = { lat: 42.3601, lng: -71.0589 };

export default function SearchMap({ organs, selectedId, onSelect }) {
  const node = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const maps = await loadGoogleMaps();
        const [{ Map }, { AdvancedMarkerElement }] = await Promise.all([
          maps.importLibrary("maps"),
          maps.importLibrary("marker")
        ]);
        if (cancelled || !node.current) return;

        if (!mapRef.current) {
          mapRef.current = new Map(node.current, {
            center: CENTER,
            zoom: 10,
            mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID",
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false
          });
        }

        markersRef.current.forEach((marker) => { marker.map = null; });
        markersRef.current = [];

        const bounds = new maps.LatLngBounds();
        let count = 0;

        for (const organ of organs) {
          const lat = Number(organ.location?.latitude);
          const lng = Number(organ.location?.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

          const content = document.createElement("button");
          content.type = "button";
          content.className = [
            "map-marker",
            organ.listingOwnership === "unclaimed" ? "unclaimed" : "",
            selectedId === organ.id ? "selected" : ""
          ].filter(Boolean).join(" ");
          content.textContent = organ.ratingCount ? `${organ.ratingAverage.toFixed(1)}★` : "●";
          content.setAttribute("aria-label", `Select ${organ.name}`);
          content.addEventListener("click", () => onSelect(organ.id));

          const position = { lat, lng };
          const marker = new AdvancedMarkerElement({
            map: mapRef.current,
            position,
            title: organ.name,
            content
          });
          markersRef.current.push(marker);
          bounds.extend(position);
          count += 1;
        }

        if (count === 1) {
          mapRef.current.setCenter(bounds.getCenter());
          mapRef.current.setZoom(14);
        } else if (count > 1) {
          mapRef.current.fitBounds(bounds, 56);
        }
        setMessage("");
      } catch (error) {
        if (!cancelled) {
          setMessage(toUserMessage(error, "The map is temporarily unavailable. The organ list still works."));
        }
      }
    }

    render();
    return () => {
      cancelled = true;
      markersRef.current.forEach((marker) => { marker.map = null; });
      markersRef.current = [];
    };
  }, [organs, selectedId, onSelect]);

  if (message) {
    return <div className="map-fallback"><p>{message}</p></div>;
  }

  return <div className="search-map" ref={node} aria-label="Map of organ listings" />;
}
