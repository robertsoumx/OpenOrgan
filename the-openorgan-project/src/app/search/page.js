import SearchExperience from "@/components/SearchExperience";
import { getOrganDirectory } from "@/lib/directory-server";
export const revalidate = 3600;
export const metadata = { title: "Find organs", description: "Find pipe organs by place or driving route and compare practice availability, costs, and instrument details.", alternates: { canonical: "/search" } };
export default async function SearchPage(){ const organs = await getOrganDirectory(); return <SearchExperience initialOrgans={organs}/>; }
