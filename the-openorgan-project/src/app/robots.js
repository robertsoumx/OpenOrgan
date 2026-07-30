import { siteUrl } from "@/lib/config";
export default function robots() { return { rules: { userAgent: "*", allow: "/", disallow: ["/dashboard", "/organization", "/profile", "/admin", "/verification"] }, sitemap: `${siteUrl}/sitemap.xml` }; }
