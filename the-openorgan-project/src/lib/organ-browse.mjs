import { toDate } from "./format.js";

export function browseOrgans(organs, { search = "", listingStatus = "all", availability = "all", sort = "claimed", reviews = {}, routes = {}, routeReady = false } = {}) {
  const query = search.trim().toLowerCase();
  return organs.filter(organ => {
    const claimed = organ.listingOwnership === "claimed", accepts = claimed && organ.bookingEnabled;
    if (listingStatus === "claimed" && !claimed || listingStatus === "unclaimed" && organ.listingOwnership !== "unclaimed" || listingStatus === "pending" && organ.claimStatus !== "pending") return false;
    if (availability === "accepting" && !accepts || availability === "unavailable" && accepts) return false;
    return [organ.name, organ.organizationName, organ.builder, organ.location?.city, organ.location?.formattedAddress].join(" ").toLowerCase().includes(query);
  }).map(organ => ({ ...organ, ...reviews[organ.id], ...routes[organ.id] })).sort((a, b) => {
    const byName = () => String(a.name || "").localeCompare(String(b.name || ""));
    if (sort === "claimed") return Number(b.listingOwnership === "claimed") - Number(a.listingOwnership === "claimed") || byName();
    if (sort === "distance" && routeReady) return (a.routeDistanceMeters ?? Infinity) - (b.routeDistanceMeters ?? Infinity) || byName();
    if (sort === "rating") return (b.ratingAverage || 0) - (a.ratingAverage || 0) || byName();
    if (sort === "newest") return (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0) || byName();
    return byName();
  });
}
