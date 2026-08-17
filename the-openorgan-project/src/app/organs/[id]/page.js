import OrganDetailClient from "@/components/OrganDetailClient";
import { getPublicDocument } from "@/lib/server-data";
import { siteUrl } from "@/lib/config";

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function organDescription(organ) {
  if (!organ) return "View pipe organ details through The OpenOrgan Project.";
  const place = [organ.location?.city, organ.location?.region].filter(Boolean).join(", ");
  const facts = [
    organ.builder ? `built by ${organ.builder}` : "",
    organ.year ? `dating from ${organ.year}` : "",
    organ.manuals ? `${organ.manuals} manuals` : "",
    organ.stops ? `${organ.stops} stops` : ""
  ].filter(Boolean).join(", ");
  const access = organ.listingOwnership === "claimed"
    ? "See practice-access details, pricing, location, and verified reviews."
    : "View this unclaimed church-organ reference listing and source information.";
  return clean(`${organ.name || "Pipe organ"}${place ? ` in ${place}` : ""}${facts ? `, ${facts}` : ""}. ${access}`).slice(0, 158);
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const organ = await getPublicDocument("organs", id);
  if (!organ) {
    return {
      title: "Pipe Organ Listing",
      description: "View pipe organ listings through The OpenOrgan Project.",
      robots: { index: false, follow: true }
    };
  }

  const place = [organ.location?.city, organ.location?.region].filter(Boolean).join(", ");
  const title = `${organ.name || "Pipe Organ"}${place ? ` — ${place}` : ""}`;
  const description = organDescription(organ);
  const image = organ.imageUrl || "/opengraph-image";

  return {
    title,
    description,
    alternates: { canonical: `/organs/${id}` },
    openGraph: {
      title,
      description,
      type: "website",
      url: `/organs/${id}`,
      images: [image]
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image]
    }
  };
}

export default async function OrganPage({ params }) {
  const { id } = await params;
  const organ = await getPublicDocument("organs", id);

  const structuredData = organ ? {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${siteUrl}/organs/${id}#webpage`,
    url: `${siteUrl}/organs/${id}`,
    name: organ.name,
    description: organDescription(organ),
    mainEntity: {
      "@type": "Place",
      name: organ.organizationName || organ.name,
      address: organ.location?.formattedAddress
        ? {
            "@type": "PostalAddress",
            streetAddress: organ.location.formattedAddress,
            addressLocality: organ.location.city || undefined,
            addressRegion: organ.location.region || undefined,
            postalCode: organ.location.postalCode || undefined,
            addressCountry: organ.location.country || "US"
          }
        : undefined,
      geo: Number.isFinite(Number(organ.location?.latitude))
        ? {
            "@type": "GeoCoordinates",
            latitude: Number(organ.location.latitude),
            longitude: Number(organ.location.longitude)
          }
        : undefined,
      url: organ.location?.googleMapsUri || `${siteUrl}/organs/${id}`
    }
  } : null;

  return (
    <>
      {structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
        />
      )}
      <OrganDetailClient id={id} initialOrgan={organ} />
    </>
  );
}
