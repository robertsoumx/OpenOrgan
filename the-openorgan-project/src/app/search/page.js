import SearchExperience from "@/components/SearchExperience";
import { getActivePublicDocuments } from "@/lib/server-data";
export const revalidate = 3600;
export const metadata = { title: "Find Pipe Organs", description: "Browse pipe organs, practice-access listings, prices, ratings, and map locations with venue addresses.", alternates: { canonical: "/search" } };
export default async function SearchPage(){ const organs = await getActivePublicDocuments("organs", 5000); return <SearchExperience initialOrgans={organs}/>; }
