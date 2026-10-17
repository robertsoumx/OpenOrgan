import SearchExperience from "@/components/SearchExperience";
import { getOrganDirectory } from "@/lib/directory-server";
export const revalidate = 3600;
export const metadata = { title: "Find Pipe Organs", description: "Browse pipe organs, practice-access listings, prices, ratings, and map locations with venue addresses.", alternates: { canonical: "/search" } };
export default async function SearchPage(){ const organs = await getOrganDirectory(); return <SearchExperience initialOrgans={organs}/>; }
