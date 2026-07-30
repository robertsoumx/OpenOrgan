import { getActivePublicDocuments } from "@/lib/server-data";
import { siteUrl } from "@/lib/config";

function publicEntry(path, item, priority) {
  const modified = item?.updatedAt || item?.createdAt;
  return {
    url: `${siteUrl}${path}`,
    ...(modified ? { lastModified: modified } : {}),
    changeFrequency: "weekly",
    priority
  };
}

export default async function sitemap() {
  const [organs, events] = await Promise.all([
    getActivePublicDocuments("organs"),
    getActivePublicDocuments("events")
  ]);

  const staticPages = ["", "/about", "/search", "/events"].map((path) => ({
    url: `${siteUrl}${path}`,
    changeFrequency: "weekly",
    priority: path === "" ? 1 : 0.8
  }));

  return [
    ...staticPages,
    ...organs.map((item) => publicEntry(`/organs/${item.id}`, item, 0.8)),
    ...events.map((item) => publicEntry(`/events/${item.id}`, item, 0.7))
  ];
}
