import { getActivePublicDocuments } from "@/lib/server-data";

export const runtime = "nodejs";

function chunks(values, size) {
  const output = [];
  for (let index = 0; index < values.length; index += size) {
    output.push(values.slice(index, index + size));
  }
  return output;
}

export async function POST(request) {
  try {
    const key = process.env.GOOGLE_MAPS_SERVER_API_KEY;
    if (!key) {
      return Response.json({ error: "Google Routes is not configured." }, { status: 503 });
    }

    const body = await request.json();
    const latitude = Number(body.origin?.latitude);
    const longitude = Number(body.origin?.longitude);
    const requested = Array.isArray(body.destinations)
      ? body.destinations.filter((item) => item?.id && item?.placeId).slice(0, 100)
      : [];

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !requested.length) {
      return Response.json(
        { error: "A valid origin and at least one destination are required." },
        { status: 400 }
      );
    }

    const activeOrgans = await getActivePublicDocuments("organs", 500);
    const allowed = new Map(
      activeOrgans
        .filter((organ) => organ.location?.placeId)
        .map((organ) => [organ.id, organ.location.placeId])
    );

    const destinations = requested.filter(
      (item) => allowed.get(item.id) === item.placeId
    );

    if (!destinations.length) {
      return Response.json({ error: "No valid public organ destinations were supplied." }, { status: 400 });
    }

    const results = [];
    for (const group of chunks(destinations, 25)) {
      const response = await fetch(
        "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": key,
            "X-Goog-FieldMask": "originIndex,destinationIndex,status,condition,distanceMeters,duration"
          },
          body: JSON.stringify({
            origins: [
              {
                waypoint: {
                  location: { latLng: { latitude, longitude } }
                }
              }
            ],
            destinations: group.map((item) => ({ waypoint: { placeId: item.placeId } })),
            travelMode: "DRIVE",
            routingPreference: "TRAFFIC_UNAWARE"
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Google Routes returned ${response.status}.`);
      }

      const matrix = await response.json();
      for (const row of matrix) {
        const destination = group[row.destinationIndex];
        if (!destination || row.condition !== "ROUTE_EXISTS") continue;
        results.push({
          id: destination.id,
          routeDistanceMeters: Number(row.distanceMeters),
          routeDurationSeconds: Number(String(row.duration || "0s").replace("s", ""))
        });
      }
    }

    return Response.json({ results });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: error?.message || "Unable to calculate routes." },
      { status: 500 }
    );
  }
}
