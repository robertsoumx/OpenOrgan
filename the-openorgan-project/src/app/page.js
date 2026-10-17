import RoleAwareHome from "@/components/RoleAwareHome";
import HomeHighlights from "@/components/HomeHighlights";
import { getEventFeed } from "@/lib/events-server";
export const revalidate = 21600;
export const metadata = { title: { absolute: "OpenOrgan | Pipe Organs, Events & Practice Access" }, description: "Find pipe organs, organ events, and institution-approved practice access with OpenOrgan.", alternates: { canonical: "/" } };
export default async function HomePage() {
  const feed = await getEventFeed();
  return <><RoleAwareHome /><HomeHighlights events={feed.events} /></>;
}
