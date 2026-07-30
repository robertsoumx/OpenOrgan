import EventDetailClient from "@/components/EventDetailClient";
import { getPublicDocument } from "@/lib/server-data";
export async function generateMetadata({params}){const{id}=await params;const event=await getPublicDocument("events",id);return{title:event?.title||"Organ Event",description:event?.description?.slice(0,155)||"Organ event listed through The OpenOrgan Project.",alternates:{canonical:`/events/${id}`},openGraph:{title:event?.title||"Organ Event",description:event?.description||"Organ event",type:"website",images:event?.imageUrl?[event.imageUrl]:["/openorgan-logo.svg"]}};}
export default async function EventPage({params}){const{id}=await params;const event=await getPublicDocument("events",id);return <EventDetailClient id={id} initialEvent={event}/>;}
