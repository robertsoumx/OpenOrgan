import { timingSafeEqual } from "node:crypto";
import { revalidateTag, revalidatePath } from "next/cache";
import { getEventFeed } from "@/lib/events-server";
export const runtime = "nodejs";
export async function POST(request) {
  const secret = process.env.EVENT_REFRESH_SECRET;
  if (!secret) return Response.json({ error: "Calendar refresh is not configured." }, { status: 503 });
  const received = request.headers.get("authorization") || "";
  const expected = "Bearer " + secret;
  const a = Buffer.from(received), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a,b)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  revalidateTag("event-calendars", { expire: 0 });
  const feed = await getEventFeed();
  revalidatePath("/");
  revalidatePath("/events");
  revalidatePath("/sitemap.xml");
  const ok = feed.sources.every(source => source.ok);
  return Response.json({ ok, events: feed.events.length, checkedAt: feed.generatedAt }, { status: ok ? 200 : 503 });
}
