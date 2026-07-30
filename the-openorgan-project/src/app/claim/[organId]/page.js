import ClaimListingClient from "@/components/ClaimListingClient";
export const metadata={title:"Claim an Organ Listing",robots:{index:false,follow:false}};
export default async function ClaimPage({params}){const{organId}=await params;return <ClaimListingClient organId={organId}/>;}
