export const GUIDES = {
  organist: [
    { id:"find", title:"Find an organ", text:"Search the directory by instrument or place and use the map to inspect a listing.", href:"/search", action:"Find organs", detail:"Choose a result to read specifications, pricing, location, reviews, and practice availability." },
    { id:"request", title:"Request practice time", text:"Open a bookable listing and submit your preferred time and purpose.", href:"/search", action:"Browse listings", detail:"A request is pending until the institution approves it; reference listings cannot accept bookings." },
    { id:"reservations", title:"Manage reservations", text:"Use My dashboard to track requests, propose time changes, or cancel a reservation.", href:"/dashboard", action:"My dashboard", detail:"After a completed session, you can leave an organ review from the reservation." },
    { id:"questions", title:"Ask a question", text:"Ask the institution from an organ or event page and read replies in My dashboard.", href:"/dashboard", action:"View questions", detail:"The navigation badge marks unread answers." },
    { id:"events", title:"Find events", text:"Filter events by date, venue, performer, or address and check the official organizer page.", href:"/events", action:"Browse events", detail:"Institution events may offer signup; external events use the organizer's registration and ticketing." },
    { id:"profile", title:"Edit your profile", text:"Update your experience, photo, and contact visibility in My profile.", href:"/profile", action:"My profile", detail:"Your public profile includes completed sessions and host reviews; contact details appear only when you choose to share them." }
  ],
  organization: [
    { id:"profile", title:"Set up your institution", text:"Add your institution's name, description, location, photo, and contact visibility.", href:"/profile", action:"Edit profile", detail:"Your public profile gives organists the information they need before requesting access." },
    { id:"verification", title:"Verify your institution", text:"Complete email confirmation and manual verification before publishing listings or events.", href:"/verification", action:"Verify institution", detail:"The verification page shows your progress and any administrator note." },
    { id:"organs", title:"Add or claim an organ", text:"Use Manage to add an organ or open an existing reference listing to request ownership.", href:"/organization", action:"Manage organs", detail:"Choose the exact place, add specifications and photos, then set pricing, booking availability, and draft or published status." },
    { id:"reservations", title:"Review practice requests", text:"Open Reservations in Manage to approve, reject, reschedule, or cancel requests.", href:"/organization", action:"Review requests", detail:"Mark a finished session as completed to enable reviews and record the organist's visit." },
    { id:"events", title:"Publish events", text:"Use Events in Manage to add the program, date, time, exact venue, image, and signup policy.", href:"/organization", action:"Manage events", detail:"Save drafts while preparing an event and review attendees in Event signups after publishing." },
    { id:"questions", title:"Answer questions", text:"Open Questions in Manage to reply to organists about your listings and events.", href:"/organization", action:"View questions", detail:"The navigation badge shows open questions; the Claims tab tracks ownership requests." },
    { id:"reviews", title:"Review completed visits", text:"Open a completed reservation to review the organist and indicate whether you would host them again.", href:"/organization", action:"View reservations", detail:"Reviews appear on the organist's public profile." }
  ]
};
export function guideKey(uid, role) { return `openorgan:guide:v1:${uid}:${role}`; }
