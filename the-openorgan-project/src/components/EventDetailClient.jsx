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

export default function EventDetailClient({ id, initialEvent = null }) {
  const { user, account, profile, loading: authLoading } = useAuth();
  const [event, setEvent] = useState(initialEvent);
  const [loading, setLoading] = useState(!initialEvent);
  const [ownerProfile, setOwnerProfile] = useState(null);
  const [ownerContact, setOwnerContact] = useState(null);
  const [registered, setRegistered] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!db || !id) {
      setLoading(false);
      return;
    }
    getDoc(doc(db, "events", id))
      .then((snapshot) => setEvent(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null))
      .catch(() => setEvent(null))
      .finally(() => setLoading(false));
  }, [id]);

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
          {event.imageUrl && <img className="detail-image" src={event.imageUrl} alt="" />}
          <div>
            <span className="eyebrow">{event.type || "Event"}</span>
            <h1>{event.title}</h1>
            <p className="lead">{event.organizationName}</p>
          </div>

          <article className="card stack">
            <strong>{formatDateTime(event.startDateTime)}</strong>
            <p>{event.description}</p>
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
          <QuestionsSection targetType="event" targetId={id} ownerId={event.ownerId} />
        </div>

        <aside className="detail-sidebar stack-lg">
          <article className="card">
            <span className="eyebrow">Hosted by</span>
            <ProfileSummary profile={ownerProfile} userId={event.ownerId} contact={ownerContact} />
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
