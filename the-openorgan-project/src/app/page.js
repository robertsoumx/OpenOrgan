import RoleAwareHome from "@/components/RoleAwareHome";
import HomeHighlights from "@/components/HomeHighlights";
import { getEventFeed } from "@/lib/events-server";
export const revalidate = 21600;
export const metadata = { title: { absolute: "OpenOrgan | Boston Pipe Organs, Recitals & Practice Access" }, description: "Discover church pipe organs, upcoming organ concerts, and organization-approved practice access in Greater Boston with OpenOrgan.", alternates: { canonical: "/" } };
export default async function HomePage() {
  const feed = await getEventFeed();
  return <><RoleAwareHome /><HomeHighlights events={feed.events} /></>;
}
