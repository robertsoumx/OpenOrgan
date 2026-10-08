"use client";
import { toUserMessage } from "@/lib/user-error";

import { useEffect, useState } from "react";
import Link from "next/link";
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase-client";
import { useAuth } from "@/components/AuthProvider";
import LocationPanel from "@/components/LocationPanel";
import QuestionsSection from "@/components/QuestionsSection";
import ProfileSummary from "@/components/ProfileSummary";
import { formatDateTime } from "@/lib/format";
import { eventDate } from "@/lib/events-core.mjs";

export default function EventDetailClient({ id, initialEvent = null }) {
  const { user, account, profile, loading: authLoading } = useAuth();
  const [event, setEvent] = useState(initialEvent);
  const [loading, setLoading] = useState(!initialEvent);
  const [ownerProfile, setOwnerProfile] = useState(null);
  const [ownerContact, setOwnerContact] = useState(null);
  const [registered, setRegistered] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!db || !id || initialEvent?.origin === "curated") {
      setLoading(false);
      return;
    }
    getDoc(doc(db, "events", id))
      .then((snapshot) => setEvent(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, initialEvent?.origin]);

  useEffect(() => {
    if (!db || !event?.ownerId) return;
    Promise.all([
      getDoc(doc(db, "profiles", event.ownerId)),
      getDoc(doc(db, "publicContacts", event.ownerId)).catch(() => null)
    ]).then(([profileSnapshot, contactSnapshot]) => {
      setOwnerProfile(profileSnapshot?.exists() ? profileSnapshot.data() : null);
      setOwnerContact(contactSnapshot?.exists() ? contactSnapshot.data() : null);
    });
  }, [event?.ownerId, user?.uid]);

  useEffect(() => {
    if (!db || !user || account?.role !== "organist" || !id) return;
    getDoc(doc(db, "eventSignups", `${id}_${user.uid}`))
      .then((snapshot) => setRegistered(snapshot.exists()))
      .catch(() => {});
  }, [account?.role, id, user?.uid]);

  async function toggleSignup() {
    if (!user) return;
    if (account?.role !== "organist" || !db || !event) return;

    try {
      const reference = doc(db, "eventSignups", `${id}_${user.uid}`);
      if (registered) {
        await deleteDoc(reference);
        setRegistered(false);
        setMessage("Signup cancelled.");
      } else {
        await setDoc(reference, {
          eventId: id,
          eventOwnerId: event.ownerId,
          userId: user.uid,
          userName: profile?.displayName || user.displayName || "OpenOrgan user",
          createdAt: serverTimestamp()
        });
        setRegistered(true);
        setMessage("You are signed up.");
      }
    } catch (error) {
      setMessage(toUserMessage(error, "Unable to update your signup."));
    }
  }

  if (loading) {
    return <section className="section"><div className="container"><div className="skeleton" /></div></section>;
  }

  if (!event) {
    return (
      <section className="section">
        <div className="container empty-state">
          <h1>Event not found</h1>
          <p>This event may have been removed or is not public.</p>
        </div>
      </section>
    );
  }

  const policy = event.registrationPolicy || "none";
  const organizationAccount = account?.role === "organization";
  const organistAccount = account?.role === "organist";
  const ownsEvent = Boolean(user?.uid && event.ownerId === user.uid);
  const canSignUp = !authLoading && (!user || organistAccount);

  return (
    <section className="section">
      <div className="container detail-grid">
        <div className="stack-lg">
          {event.imageUrl && <img className="detail-image" src={event.imageUrl} alt={event.imageAlt || event.title} onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = "/event-cover.svg"; }} />}
          <div>
            <span className="eyebrow">{event.type || "Event"}</span>
            <h1>{event.title}</h1>
            <p className="lead">{event.organizationName}</p>
          </div>

          <article className="card stack">
            <strong>{event.origin === "curated" ? `${eventDate(event.startDateTime, { weekday: "long", hour: "numeric", minute: "2-digit" })} ET` : formatDateTime(event.startDateTime)}</strong>
            <p>{event.description}</p>
            {event.sourceUrl && <div className="source-panel"><strong>{event.admission || "Organizer details"}</strong><p className="small">{event.sourceName}{event.sourceCheckedAt ? ` · Schedule checked ${new Date(event.sourceCheckedAt).toLocaleDateString("en-US", { timeZone: "America/New_York" })}` : ""}</p><a className="button" href={event.sourceUrl} target="_blank" rel="noopener noreferrer">Visit official event page</a><p className="small muted">Confirm program details and schedule changes with the organizer.</p></div>}
            {policy === "required" && <div className="message warning">Signup is required for this event.</div>}
            {policy === "optional" && <p className="muted">Signup is optional but helps the organization plan.</p>}

            {policy !== "none" && canSignUp && (
              user ? (
                <button className={registered ? "button-secondary" : "button"} onClick={toggleSignup}>
                  {registered ? "Cancel Signup" : "Sign Up"}
                </button>
              ) : (
                <Link className="button" href={`/login?next=/events/${id}`}>Sign In to Sign Up</Link>
              )
            )}

            {message && <div className="message">{message}</div>}
          </article>

          <LocationPanel location={event.location} />
          {event.ownerId && <QuestionsSection targetType="event" targetId={id} ownerId={event.ownerId} />}
        </div>

        <aside className="detail-sidebar stack-lg">
          <article className="card">
            <span className="eyebrow">Hosted by</span>
            {event.ownerId ? <ProfileSummary profile={ownerProfile} userId={event.ownerId} contact={ownerContact} /> : <><h2>{event.organizationName}</h2><p>{event.location?.formattedAddress}</p>{event.imageCredit && <p className="small muted">Series image: {event.imageCredit}</p>}</>}
          </article>

          {organizationAccount && ownsEvent && (
            <article className="card stack">
              <span className="eyebrow">Your event</span>
              <h2>Manage this event</h2>
              <p className="muted">Edit details and review signups from your organization dashboard.</p>
              <Link className="button" href="/organization">Open Management</Link>
            </article>
          )}
        </aside>
      </div>
    </section>
  );
}
