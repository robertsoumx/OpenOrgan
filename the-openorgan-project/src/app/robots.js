import { siteUrl } from "@/lib/config";

export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/about", "/search", "/events", "/events/", "/organs/"],
      disallow: [
        "/api/",
        "/admin/",
        "/dashboard",
        "/organization",
        "/profile",
        "/profiles/",
        "/verification",
        "/claim/",
        "/login",
        "/register",
        "/reservation"
      ]
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl
  };
}
