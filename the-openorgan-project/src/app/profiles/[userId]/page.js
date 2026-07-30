import PublicProfileClient from "@/components/PublicProfileClient";
export const metadata={title:"Member Trust Profile",robots:{index:false,follow:false}};
export default async function ProfilePage({params}){const{userId}=await params;return <PublicProfileClient userId={userId}/>;}
