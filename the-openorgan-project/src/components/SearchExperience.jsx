"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase-client";
import OrganCard from "@/components/OrganCard";
import { toDate } from "@/lib/format";
import { apiMessage, toUserMessage, userError } from "@/lib/user-error";

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

  if (distance == null) {
    return rating * 0.643 + cost * 0.286 + reliability * 0.071;
  }
  return rating * 0.45 + distance * 0.3 + cost * 0.2 + reliability * 0.05;
}

export default function SearchExperience() {
  const [organs, setOrgans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState({ type: "", text: "" });
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("recommended");
  const [limit, setLimit] = useState(5);
  const [selectedId, setSelectedId] = useState("");
  const [view, setView] = useState("list");
  const [routing, setRouting] = useState(false);

  const selectFromMap = useCallback((id) => {
    setSelectedId(id);
    document.getElementById(`organ-card-${id}`)?.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
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
        setNotice({
          type: "error",
          text: toUserMessage(error, "We could not load the organ directory. Try again.")
        });
      })
      .finally(() => setLoading(false));
  }, []);

  async function loadRoutes() {
    if (!navigator.geolocation) {
      setNotice({ type: "error", text: "This browser cannot share a location for distance ranking." });
      return;
    }

    setRouting(true);
    setNotice({ type: "", text: "" });

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const destinations = organs
            .filter((organ) => organ.location?.placeId)
            .map((organ) => ({ id: organ.id, placeId: organ.location.placeId }));

          const response = await fetch("/api/routes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              origin: {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
              },
              destinations
            })
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw userError(apiMessage(data, response.status, "We could not calculate route distances."));
          }

          const results = new Map(data.results.map((result) => [result.id, result]));
          setOrgans((current) => current.map((organ) => ({
            ...organ,
            ...results.get(organ.id)
          })));
          setSort((current) => current === "recommended" ? current : "distance");
          setNotice({
            type: "success",
            text: "Distance ranking is ready. Results use Google driving routes."
          });
        } catch (error) {
          setNotice({
            type: "error",
            text: toUserMessage(error, "We could not calculate route distances. Try again.")
          });
        } finally {
          setRouting(false);
        }
      },
      (error) => {
        setRouting(false);
        const denied = error?.code === 1;
        setNotice({
          type: "error",
          text: denied
            ? "Location access was not allowed. You can still browse by rating, price, or recommendation."
            : "Your location could not be read. Try again or use another ranking option."
        });
      },
      { timeout: 10000, maximumAge: 300000 }
    );
  }

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
      if (sort === "newest") {
        return (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0);
      }
      if (sort === "distance") {
        return (a.routeDistanceMeters ?? Infinity) - (b.routeDistanceMeters ?? Infinity);
      }
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

  return (
    <div className="search-layout">
      <section className={`search-list-panel ${view === "map" ? "mobile-hidden" : ""}`}>
        <div className="page-header compact">
          <span className="eyebrow">Greater Boston first</span>
          <h1>Find organs</h1>
          <p>Claimed practice listings and clearly marked public reference listings.</p>
        </div>

        <div className="mobile-view-toggle">
          <button className="button" onClick={() => setView("list")}>List</button>
          <button className="button-secondary" onClick={() => setView("map")}>Map</button>
        </div>

        <div className="search-toolbar search-toolbar-extended">
          <input
            aria-label="Search organs"
            placeholder="Church, city, builder..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <select aria-label="Order organs" value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="recommended">Recommended</option>
            <option value="distance">Nearest by route</option>
            <option value="rating">Highest rated</option>
            <option value="price">Lowest cost</option>
            <option value="newest">Newest listing</option>
          </select>

          <select
            aria-label="Number of organs to show"
            value={limit}
            onChange={(event) => setLimit(event.target.value === "all" ? "all" : Number(event.target.value))}
          >
            {LIMIT_OPTIONS.map((value) => (
              <option key={value} value={value}>Show {value}</option>
            ))}
            <option value="all">Show all</option>
          </select>
        </div>

        <div className="search-status-row">
          <button className="button-secondary" onClick={loadRoutes} disabled={routing || !organs.length}>
            {routing ? "Checking Routes..." : hasRoutes ? "Refresh My Distance" : "Use My Location"}
          </button>
          <span className="muted small">
            Showing {displayed.length} of {filtered.length} matching organ{filtered.length === 1 ? "" : "s"}.
          </span>
        </div>

        {sort === "distance" && !hasRoutes && (
          <div className="message info">
            Select <strong>Use My Location</strong> to order results by Google route distance.
          </div>
        )}

        {notice.text && (
          <div className={`message ${notice.type}`} role={notice.type === "error" ? "alert" : "status"}>
            {notice.text}
          </div>
        )}

        {loading ? (
          <div className="skeleton" />
        ) : displayed.length ? (
          <div className="stack search-results">
            {displayed.map((organ) => (
              <OrganCard
                key={organ.id}
                organ={organ}
                selected={selectedId === organ.id}
                onHover={setSelectedId}
              />
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
        <SearchMap organs={displayed} selectedId={selectedId} onSelect={selectFromMap} />
      </aside>
    </div>
  );
}
