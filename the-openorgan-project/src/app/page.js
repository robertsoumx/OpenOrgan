import RoleAwareHome from "@/components/RoleAwareHome";
import HomeHighlights from "@/components/HomeHighlights";
import { getEventFeed } from "@/lib/events-server";
export const revalidate = 21600;
export const metadata = { title: { absolute: "OpenOrgan | Pipe Organs, Events & Practice Access" }, description: "Find organs and events, offer free or paid practice access, and publish upcoming events on OpenOrgan.", alternates: { canonical: "/" } };
export default async function HomePage() {
  const feed = await getEventFeed();
  return <><RoleAwareHome /><HomeHighlights events={feed.events} /></>;
}
