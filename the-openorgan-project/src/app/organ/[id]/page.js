import { redirect } from "next/navigation";
export default async function LegacyOrgan({params}){const{id}=await params;redirect(`/organs/${id}`);}
