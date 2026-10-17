export const GUIDES = {
  organist: [
    { id:"find", title:"Find organs", text:"Search instruments or places and compare locations, practice costs, and availability.", href:"/search", action:"Find organs", detail:"Use your location or a starting address to sort by driving route." },
    { id:"request", title:"Request practice time", text:"Choose a listing that accepts requests and submit your preferred time and purpose.", href:"/search", action:"Find organs", detail:"Requests need host approval; free access, recommended donations, and required fees are shown on each managed listing." },
    { id:"reservations", title:"Manage reservations", text:"Use My dashboard to track requests, propose time changes, or cancel a reservation.", href:"/dashboard", action:"My dashboard", detail:"After a completed session, you can leave an organ review from the reservation." },
    { id:"questions", title:"Ask a question", text:"Ask the institution from an organ or event page and read replies in My dashboard.", href:"/dashboard", action:"View questions", detail:"The navigation badge marks unread answers." },
    { id:"events", title:"Find events", text:"Search by performer or venue, filter by date, or sort venues by driving route.", href:"/events", action:"Find events", detail:"Sign up where offered, or follow the organizer's link for tickets and current details." },
    { id:"profile", title:"Edit your profile", text:"Update your experience, photo, and contact visibility in My profile.", href:"/profile", action:"My profile", detail:"Your public profile includes completed sessions and host reviews; contact details appear only when you choose to share them." }
  ],
  organization: [
    { id:"profile", title:"Set up your institution", text:"Add your institution's name, description, location, photo, and contact visibility.", href:"/profile", action:"Edit profile", detail:"Your public profile gives organists the information they need before requesting access." },
    { id:"verification", title:"Verify your institution", text:"Complete email confirmation and manual verification before publishing listings or events.", href:"/verification", action:"Verify institution", detail:"The verification page shows your progress and any administrator note." },
    { id:"organs", title:"Offer practice access", text:"Add an organ or claim a reference listing, then choose whether to accept practice requests.", href:"/organization", action:"Manage listings", detail:"Set free access, a recommended donation, or a required fee, with any payment arranged directly with your institution." },
    { id:"reservations", title:"Review practice requests", text:"Open Reservations in Manage listings to approve, reject, reschedule, or cancel requests.", href:"/organization", action:"Review requests", detail:"Mark a finished session as completed to enable reviews and record the organist's visit." },
    { id:"events", title:"Publish events", text:"Add your program, date, time, venue, image, and signup policy in Events under Manage listings.", href:"/organization", action:"Manage events", detail:"Publish after verification to appear in Find events, or save a draft while preparing your program." },
    { id:"questions", title:"Answer questions", text:"Open Questions in Manage listings to reply about your organs and events.", href:"/organization", action:"View questions", detail:"The navigation badge shows open questions; the Claims tab tracks ownership requests." },
    { id:"reviews", title:"Review completed visits", text:"Open a completed reservation to review the organist and indicate whether you would host them again.", href:"/organization", action:"View reservations", detail:"Reviews appear on the organist's public profile." }
  ]
};
export function guideKey(uid, role) { return `openorgan:guide:v1:${uid}:${role}`; }
