import { getDirectoryOrgan } from "@/lib/directory-server";
import { notFound } from "next/navigation";
import ClaimListingClient from "@/components/ClaimListingClient";
export const metadata={title:"Claim an Organ Listing",robots:{index:false,follow:false}};
export default async function ClaimPage({params}){const{organId}=await params;const organ=await getDirectoryOrgan(organId);if(!organ)notFound();return <ClaimListingClient organId={organId} initialOrgan={organ}/>;}
