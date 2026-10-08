"use client";

import Link from "next/link";
import { formatPricing } from "@/lib/format";
import { trackEvent } from "@/lib/analytics-client";
import { cleanText } from "@/lib/events-core.mjs";

export default function OrganCard({ organ, selected, onHover }) {
  const hasImage = Boolean(organ.imageUrl);
  const unclaimed = organ.listingOwnership === "unclaimed";

  function recordOpen() {
    trackEvent("organ_open", {
      feature: "organ_directory",
      action: "open_listing",
      targetType: "organ",
      targetId: organ.id,
      listingOwnership: organ.listingOwnership || "claimed",
      pricingModel: organ.pricing?.model || "free"
    });
  }

  return (
    <Link
      id={`organ-card-${organ.id}`}
      href={`/organs/${organ.id}`}
      aria-label={`View ${organ.name}`}
      className={`organ-card ${hasImage ? "has-image" : "no-image"} ${selected ? "selected" : ""}`}
      onMouseEnter={() => onHover?.(organ.id)}
      onFocus={() => onHover?.(organ.id)}
      onClick={recordOpen}
    >
      {hasImage && (
        <div className="organ-card-image">
          <img src={organ.imageUrl} alt={cleanText(organ.name)} loading="lazy" />
          {unclaimed && <strong className="unclaimed-badge organ-card-badge">UNCLAIMED LISTING</strong>}
        </div>
      )}
      {!hasImage && <div className="organ-card-art" aria-hidden="true"><svg viewBox="0 0 90 120"><g fill="#376671"><path d="M8 43h10v63H8zM24 25h10v81H24zM40 8h10v98H40zM56 25h10v81H56zM72 43h10v63H72z"/></g><path d="M5 109h80v6H5z" fill="#bd7490"/></svg></div>}

      <div className="organ-card-body">
        {!hasImage && unclaimed && <strong className="unclaimed-badge organ-card-badge-inline">UNCLAIMED LISTING</strong>}
        <span className="eyebrow organ-location-label">{organ.location?.city || "Greater Boston"}</span>
        <h2>{cleanText(organ.name)}</h2>
        {organ.organizationName && organ.organizationName !== organ.name && <p>{cleanText(organ.organizationName)}</p>}
        <div className="organ-facts">
          <span>{organ.ratingCount ? `${Number(organ.ratingAverage || 0).toFixed(1)} / 5 (${organ.ratingCount} reviews)` : "Not yet rated"}</span>
          <span>{unclaimed ? "Reference listing" : formatPricing(organ.pricing)}</span>
          {Number.isFinite(organ.routeDistanceMeters) && (
            <span>{(organ.routeDistanceMeters / 1609.344).toFixed(1)} mi · {Math.round((organ.routeDurationSeconds || 0) / 60)} min</span>
          )}
        </div>
        <p className="muted">
          {unclaimed
            ? "Church organ sourced from the Pipe Organ Database. Practice requests are unavailable until the church claims the listing."
            : organ.description?.slice(0, 130)}
        </p>
        {organ.importMeta?.verifiedAt && <p className="organ-source muted">Source checked {new Date(organ.importMeta.verifiedAt).toLocaleDateString("en-US", { timeZone: "America/New_York" })}</p>}
      </div>
    </Link>
  );
}
