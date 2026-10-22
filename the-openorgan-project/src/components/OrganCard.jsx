"use client";

import Link from "next/link";
import { formatPricing } from "@/lib/format";
import { trackEvent } from "@/lib/analytics-client";
import { cleanText } from "@/lib/events-core.mjs";
import TaskGlyph from "@/components/TaskGlyph";

export default function OrganCard({ organ, selected, onHover }) {
  const unclaimed = organ.listingOwnership === "unclaimed";
  const specs = [organ.builder, Number(organ.manuals) > 0 && organ.manuals + " manuals", Number(organ.stops) > 0 && organ.stops + " stops"].filter(Boolean);
  function recordOpen() {
    trackEvent("organ_open", { feature: "organ_directory", action: "open_listing", targetType: "organ", targetId: organ.id, listingOwnership: organ.listingOwnership || "claimed", pricingModel: organ.pricing?.model || "free" });
  }
  return <Link id={"organ-card-" + organ.id} href={"/organs/" + organ.id}
    className={"organ-card " + (organ.imageUrl ? "has-image" : "no-image") + (selected ? " selected" : "")}
    onMouseEnter={() => onHover?.(organ.id)} onFocus={() => onHover?.(organ.id)} onClick={recordOpen}>
    {organ.imageUrl && <div className="organ-card-image"><img src={organ.imageUrl} alt="" loading="lazy" width="160" height="160"/></div>}
    <div className="organ-card-body">
      <div className="organ-card-heading"><TaskGlyph/><h2>{cleanText(organ.name)}</h2><svg className="organ-card-arrow" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 10h13m-5-5 5 5-5 5"/></svg></div>
      <p className="organ-place">{organ.location?.city || organ.location?.formattedAddress || "Location unavailable"}</p>
      {specs.length > 0 && <p className="organ-specs">{specs.join(" · ")}</p>}
      <div className="organ-facts">
        <span className={organ.bookingEnabled && !unclaimed ? "access-open" : ""}>{unclaimed ? "Reference · Practice requests unavailable" : organ.bookingEnabled ? "Accepts requests · " + formatPricing(organ.pricing) : "Practice requests unavailable"}</span>
        {Number(organ.ratingCount) > 0 && <span>{Number(organ.ratingAverage || 0).toFixed(1)} / 5 ({organ.ratingCount} reviews)</span>}
        {Number.isFinite(organ.routeDistanceMeters) && <span>{(organ.routeDistanceMeters / 1609.344).toFixed(1)} mi · {Math.round(organ.routeDurationSeconds / 60)} min driving</span>}
      </div>
    </div>
  </Link>;
}
