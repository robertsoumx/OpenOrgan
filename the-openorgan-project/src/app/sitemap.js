import { getActivePublicDocuments } from "@/lib/server-data";
import { siteUrl } from "@/lib/config";
import { getEventFeed } from "@/lib/events-server";

export const revalidate = 3600;

function dateValue(value) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : undefined;
}

function publicEntry(path, item, priority, frequency = "weekly") {
  const lastModified = dateValue(item?.updatedAt || item?.createdAt);
  return {
    url: `${siteUrl}${path}`,
    ...(lastModified ? { lastModified } : {}),
    changeFrequency: frequency,
    priority
  };
}

export default async function sitemap() {
  const [organs, events] = await Promise.all([
    getActivePublicDocuments("organs", 5000),
    getEventFeed().then(feed => feed.events)
  ]);

  const staticPages = [
    { path: "", priority: 1, frequency: "weekly" },
    { path: "/search", priority: 0.95, frequency: "daily" },
    { path: "/events", priority: 0.85, frequency: "daily" },
    { path: "/about", priority: 0.65, frequency: "monthly" }
  ].map((item) => ({
    url: `${siteUrl}${item.path}`,
    changeFrequency: item.frequency,
    priority: item.priority
  }));

  return [
    ...staticPages,
    ...organs.map((item) => publicEntry(`/organs/${item.id}`, item, 0.9, "weekly")),
    ...events.map((item) => publicEntry(`/events/${item.id}`, item, 0.8, "weekly"))
  ];
}
