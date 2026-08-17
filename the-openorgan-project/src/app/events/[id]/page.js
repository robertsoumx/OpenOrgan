import EventDetailClient from "@/components/EventDetailClient";
import { getPublicDocument } from "@/lib/server-data";
import { siteUrl } from "@/lib/config";

function toIso(value) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

function eventDescription(event) {
  if (!event) return "Organ events through The OpenOrgan Project.";
  const place = [event.location?.name, event.location?.city, event.location?.region].filter(Boolean).join(", ");
  const base = event.description || `${event.title} hosted by ${event.organizationName || "an OpenOrgan organization"}.`;
  return `${base}${place ? ` Location: ${place}.` : ""}`.replace(/\s+/g, " ").trim().slice(0, 158);
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const event = await getPublicDocument("events", id);
  if (!event) {
    return {
      title: "Organ Event",
      description: "Find organ concerts, workshops, services, and events through The OpenOrgan Project.",
      robots: { index: false, follow: true }
    };
  }

  const city = event.location?.city ? ` — ${event.location.city}` : "";
  const title = `${event.title || "Organ Event"}${city}`;
  const description = eventDescription(event);
  const image = event.imageUrl || "/opengraph-image";

  return {
    title,
    description,
    alternates: { canonical: `/events/${id}` },
    openGraph: {
      title,
      description,
      type: "website",
      url: `/events/${id}`,
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

export default async function EventPage({ params }) {
  const { id } = await params;
  const event = await getPublicDocument("events", id);

  const structuredData = event ? {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: eventDescription(event),
    startDate: toIso(event.startDateTime),
    endDate: toIso(event.endDateTime),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    url: `${siteUrl}/events/${id}`,
    image: event.imageUrl ? [event.imageUrl] : undefined,
    location: {
      "@type": "Place",
      name: event.location?.name,
      address: event.location?.formattedAddress
    },
    organizer: {
      "@type": "Organization",
      name: event.organizationName || "The OpenOrgan Project"
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
      <EventDetailClient id={id} initialEvent={event} />
    </>
  );
}
