"use client";
import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/google-maps-client";
const DEFAULT_CENTER = { lat: 42.3601, lng: -71.0589 };
function part(components, type, short = false) { const item = components?.find((value) => value.types?.includes(type)); return item ? (short ? item.shortText || item.longText : item.longText || item.shortText) || "" : ""; }
export default function PlacePicker({ value, onChange, label = "Location" }) {
  const mapNode = useRef(null); const searchNode = useRef(null); const markerRef = useRef(null); const onChangeRef = useRef(onChange); const [message, setMessage] = useState("");
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => {
    let cancelled = false; let autocomplete = null; let handler = null;
    async function initialize() {
      try {
        const maps = await loadGoogleMaps();
        const [{ Map }, { AdvancedMarkerElement }, places] = await Promise.all([maps.importLibrary("maps"), maps.importLibrary("marker"), maps.importLibrary("places")]);
        if (cancelled || !mapNode.current || !searchNode.current) return;
        const valid = Number.isFinite(Number(value?.latitude)) && Number.isFinite(Number(value?.longitude));
        const position = valid ? { lat: Number(value.latitude), lng: Number(value.longitude) } : DEFAULT_CENTER;
        const map = new Map(mapNode.current, { center: position, zoom: value?.placeId ? 16 : 10, mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID", mapTypeControl: false, streetViewControl: false });
        if (value?.placeId) markerRef.current = new AdvancedMarkerElement({ map, position });
        searchNode.current.innerHTML = "";
        autocomplete = new places.PlaceAutocompleteElement();
        autocomplete.placeholder = "Search Google Maps for a church, school, or venue";
        autocomplete.style.width = "100%";
        handler = async (event) => {
          try {
            const place = event.placePrediction?.toPlace(); if (!place) return;
            await place.fetchFields({ fields: ["id", "displayName", "formattedAddress", "location", "viewport", "googleMapsURI", "addressComponents"] });
            if (!place.id || !place.location) throw new Error("Select a specific Google Maps result.");
            if (place.viewport) map.fitBounds(place.viewport); else { map.setCenter(place.location); map.setZoom(16); }
            if (markerRef.current) markerRef.current.map = null;
            markerRef.current = new AdvancedMarkerElement({ map, position: place.location });
            const components = place.addressComponents || [];
            onChangeRef.current?.({ placeId: place.id, name: place.displayName || "", formattedAddress: place.formattedAddress || "", googleMapsUri: place.googleMapsURI || "", latitude: place.location.lat(), longitude: place.location.lng(), city: part(components, "locality") || part(components, "postal_town") || part(components, "administrative_area_level_2"), region: part(components, "administrative_area_level_1", true), postalCode: part(components, "postal_code"), country: part(components, "country") });
            setMessage("");
          } catch (error) { setMessage(error.message || "Unable to select this place."); }
        };
        autocomplete.addEventListener("gmp-select", handler); searchNode.current.appendChild(autocomplete);
      } catch (error) { if (!cancelled) setMessage(error.message || "Unable to load Google Maps."); }
    }
    initialize();
    return () => { cancelled = true; if (autocomplete && handler) autocomplete.removeEventListener("gmp-select", handler); if (markerRef.current) markerRef.current.map = null; markerRef.current = null; };
  }, [value?.placeId]);
  return <div className="stack"><label>{label}</label>{message && <div className="message warning">{message}</div>}<div ref={searchNode} className="place-search" /><div ref={mapNode} className="map-shell picker-map" />{value?.placeId ? <div className="message success"><strong>{value.name}</strong><br />{value.formattedAddress}<div><button className="button-ghost" type="button" onClick={() => onChangeRef.current?.(null)}>Choose another place</button></div></div> : <p className="muted small">Select the exact location from Google Maps.</p>}</div>;
}
