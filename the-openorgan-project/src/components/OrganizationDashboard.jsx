"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch
} from "firebase/firestore";
import AuthGate from "@/components/AuthGate";
import { useAuth } from "@/components/AuthProvider";
import { db } from "@/lib/firebase-client";
import OrganEditor from "@/components/OrganEditor";
import EventEditor from "@/components/EventEditor";
import ReservationCard from "@/components/ReservationCard";
import { formatDateTime } from "@/lib/format";
import { toUserMessage } from "@/lib/user-error";

function Console() {
  const { user, account, profile } = useAuth();
  const [tab, setTab] = useState("overview");
  const [organs, setOrgans] = useState([]);
  const [events, setEvents] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [signups, setSignups] = useState([]);
  const [claims, setClaims] = useState([]);
  const [editingOrgan, setEditingOrgan] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [creatingOrgan, setCreatingOrgan] = useState(false);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [answers, setAnswers] = useState({});
  const [notice, setNotice] = useState({ type: "", text: "" });

  async function load() {
    if (!db || !user) return;

    const [organSnapshot, eventSnapshot, reservationSnapshot, questionSnapshot, signupSnapshot, claimSnapshot] = await Promise.all([
      getDocs(query(collection(db, "organs"), where("ownerId", "==", user.uid))),
      getDocs(query(collection(db, "events"), where("ownerId", "==", user.uid))),
      getDocs(query(collection(db, "reservations"), where("organizationOwnerId", "==", user.uid))),
      getDocs(query(collection(db, "questions"), where("ownerId", "==", user.uid))),
      getDocs(query(collection(db, "eventSignups"), where("eventOwnerId", "==", user.uid))),
      getDocs(query(collection(db, "claimRequests"), where("organizationId", "==", user.uid)))
    ]);

    const organItems = organSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    const eventItems = eventSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    const eventMap = new Map(eventItems.map((item) => [item.id, item]));
    const signupItems = signupSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }));

    const contactMap = new Map();
    await Promise.all([...new Set(signupItems.map((item) => item.userId))].map(async (uid) => {
      const contactSnapshot = await getDoc(doc(db, "publicContacts", uid)).catch(() => null);
      if (contactSnapshot?.exists() && contactSnapshot.data().visible) {
        contactMap.set(uid, contactSnapshot.data().email);
      }
    }));

    setOrgans(organItems);
    setEvents(eventItems);
    setReservations(
      reservationSnapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    );
    setQuestions(
      questionSnapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    );
    setClaims(claimSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    setSignups(signupItems.map((item) => ({
      ...item,
      event: eventMap.get(item.eventId) || null,
      contactEmail: contactMap.get(item.userId) || ""
    })));
  }

  useEffect(() => {
    load().catch((error) => {
      setNotice({
        type: "error",
        text: toUserMessage(error, "We could not load the organization dashboard. Try again.")
      });
    });
  }, [user?.uid]);

  async function answer(question) {
    const value = answers[question.id]?.trim();
    if (!value) return;

    try {
      await updateDoc(doc(db, "questions", question.id), {
        answer: value,
        status: "answered",
        readByAsker: false,
        answeredAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setAnswers((current) => ({ ...current, [question.id]: "" }));
      setNotice({ type: "success", text: "Answer published. The user has a dashboard notification." });
      await load();
    } catch (error) {
      setNotice({
        type: "error",
        text: toUserMessage(error, "We could not publish the answer. Try again.")
      });
    }
  }

  async function removeDocument(collectionName, id, label) {
    if (!window.confirm(`Delete this ${label}?`)) return;

    try {
      if (collectionName === "organs") {
        const batch = writeBatch(db);
        const privateReference = doc(db, "organPrivate", id);
        const privateSnapshot = await getDoc(privateReference).catch(() => null);
        if (privateSnapshot?.exists()) batch.delete(privateReference);
        batch.delete(doc(db, "organs", id));
        await batch.commit();
      } else {
        await deleteDoc(doc(db, collectionName, id));
      }
      setNotice({ type: "success", text: `${label} deleted.` });
      await load();
    } catch (error) {
      setNotice({
        type: "error",
        text: toUserMessage(error, `We could not delete this ${label}.`)
      });
    }
  }

  const verificationText = {
    unverified: "Email verification has not started.",
    code_sent: "A verification code has been sent.",
    pending_manual: "Email confirmed. Waiting for manual review.",
    verified: "Your organization is verified and may publish.",
    rejected: "Verification was not approved. Review the administrator note."
  }[account?.verificationStatus] || account?.verificationStatus;

  const tabs = [
    ["overview", "Overview"],
    ["organs", `Organs (${organs.length})`],
    ["events", `Events (${events.length})`],
    ["reservations", `Reservations (${reservations.length})`],
    ["questions", `Questions (${questions.filter((item) => item.status === "open").length})`],
    ["signups", `Event Signups (${signups.length})`],
    ["claims", `Claims (${claims.length})`]
  ];

  return (
    <section className="section">
      <div className="container">
        <div className="page-header">
          <span className="eyebrow">Organization dashboard</span>
          <h1>{profile?.organizationName || "Your organization"}</h1>
          <p>Manage listings, events, requests, questions, and community trust.</p>
          <div className="form-actions">
            <Link className="button-secondary" href="/profile">Edit Organization Profile</Link>
          </div>
        </div>

        <div className={`message ${account?.verificationStatus === "verified" ? "success" : "warning"}`}>
          <strong>Verification: {account?.verificationStatus?.replaceAll("_", " ")}</strong>
          <div>{verificationText}</div>
          {account?.verificationNote && (
            <div><strong>Administrator note:</strong> {account.verificationNote}</div>
          )}
          {account?.verificationStatus !== "verified" && (
            <div className="form-actions">
              <Link className="button-secondary" href="/verification">Verify Organization</Link>
            </div>
          )}
        </div>

        <div className="tabs">
          {tabs.map(([value, label]) => (
            <button key={value} className={tab === value ? "active" : ""} onClick={() => setTab(value)}>
              {label}
            </button>
          ))}
        </div>

        {notice.text && (
          <div className={`message ${notice.type}`} role={notice.type === "error" ? "alert" : "status"}>
            {notice.text}
          </div>
        )}

        {tab === "overview" && (
          <div className="grid-3">
            <article className="card interactive-card"><h2>{organs.length}</h2><p>organ listings</p></article>
            <article className="card interactive-card"><h2>{reservations.filter((item) => item.status === "pending").length}</h2><p>pending requests</p></article>
            <article className="card interactive-card"><h2>{events.length}</h2><p>events</p></article>
          </div>
        )}

        {tab === "organs" && (
          <div className="stack-lg">
            <div className="flex-between">
              <h2>Organs</h2>
              <button className="button" onClick={() => { setCreatingOrgan(true); setEditingOrgan(null); }}>Add Organ</button>
            </div>

            {(creatingOrgan || editingOrgan) && (
              <OrganEditor
                user={user}
                account={account}
                profile={profile}
                organ={editingOrgan}
                onSaved={async () => {
                  setCreatingOrgan(false);
                  setEditingOrgan(null);
                  await load();
                }}
                onCancel={() => { setCreatingOrgan(false); setEditingOrgan(null); }}
              />
            )}

            <div className="stack">
              {organs.length ? organs.map((organ) => (
                <article className="card flex-between" key={organ.id}>
                  <div>
                    {organ.listingOwnership === "unclaimed" && <strong className="unclaimed-badge">UNCLAIMED LISTING</strong>}
                    <h3>{organ.name}</h3>
                    <p className="muted">{organ.status} · {organ.bookingEnabled ? "booking enabled" : "booking disabled"}</p>
                    <Link href={`/organs/${organ.id}`}>View public page</Link>
                  </div>
                  <div className="form-actions">
                    <button className="button-secondary" onClick={() => { setEditingOrgan(organ); setCreatingOrgan(false); }}>Edit</button>
                    <button className="button-danger" onClick={() => removeDocument("organs", organ.id, "organ")}>Delete</button>
                  </div>
                </article>
              )) : !creatingOrgan ? (
                <div className="empty-state">
                  <h2>No organs yet</h2>
                  <p>Add an instrument when you are ready to create your first listing.</p>
                  <button className="button" onClick={() => { setCreatingOrgan(true); setEditingOrgan(null); }}>Add Organ</button>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {tab === "events" && (
          <div className="stack-lg">
            <div className="flex-between">
              <h2>Events</h2>
              <button className="button" onClick={() => { setCreatingEvent(true); setEditingEvent(null); }}>Add Event</button>
            </div>

            {(creatingEvent || editingEvent) && (
              <EventEditor
                user={user}
                account={account}
                profile={profile}
                eventItem={editingEvent}
                onSaved={async () => {
                  setCreatingEvent(false);
                  setEditingEvent(null);
                  await load();
                }}
                onCancel={() => { setCreatingEvent(false); setEditingEvent(null); }}
              />
            )}

            <div className="stack">
              {events.length ? events.map((event) => (
                <article className="card flex-between" key={event.id}>
                  <div>
                    <h3>{event.title}</h3>
                    <p className="muted">{formatDateTime(event.startDateTime)} · {event.status}</p>
                    <Link href={`/events/${event.id}`}>View public page</Link>
                  </div>
                  <div className="form-actions">
                    <button className="button-secondary" onClick={() => { setEditingEvent(event); setCreatingEvent(false); }}>Edit</button>
                    <button className="button-danger" onClick={() => removeDocument("events", event.id, "event")}>Delete</button>
                  </div>
                </article>
              )) : !creatingEvent ? (
                <div className="empty-state">
                  <h2>No events yet</h2>
                  <p>Create a concert, service, workshop, or other public event when you are ready.</p>
                  <button className="button" onClick={() => { setCreatingEvent(true); setEditingEvent(null); }}>Add Event</button>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {tab === "reservations" && (
          <div className="stack">
            {reservations.length ? reservations.map((reservation) => (
              <ReservationCard
                key={reservation.id}
                reservation={reservation}
                viewerRole="organization"
                viewerId={user.uid}
                onChanged={load}
              />
            )) : <div className="empty-state"><h2>No reservation requests</h2></div>}
          </div>
        )}

        {tab === "questions" && (
          <div className="stack">
            {questions.length ? questions.map((question) => (
              <article className="card question-card" key={question.id}>
                <div className="flex-between">
                  <div>
                    <strong>{question.askerName}</strong>
                    <div><Link href={`/profiles/${question.askerId}`}>Open user profile</Link></div>
                  </div>
                  <span className={`status-pill ${question.status}`}>{question.status}</span>
                </div>
                <p>{question.question}</p>
                {question.answer && <div className="question-answer">{question.answer}</div>}
                {question.status === "open" && (
                  <>
                    <textarea
                      value={answers[question.id] || ""}
                      onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))}
                      placeholder="Write an answer"
                    />
                    <button className="button" onClick={() => answer(question)}>Publish Answer</button>
                  </>
                )}
              </article>
            )) : <div className="empty-state"><h2>No questions</h2></div>}
          </div>
        )}

        {tab === "signups" && (
          <div className="stack">
            {signups.length ? signups.map((signup) => (
              <article className="card flex-between" key={signup.id}>
                <div>
                  <h3>{signup.event?.title || "Event"}</h3>
                  <p>{signup.userName}</p>
                  {signup.contactEmail && <p><a href={`mailto:${signup.contactEmail}`}>{signup.contactEmail}</a></p>}
                  <Link href={`/profiles/${signup.userId}`}>View user profile</Link>
                </div>
                <span className="status-pill approved">signed up</span>
              </article>
            )) : <div className="empty-state"><h2>No event signups</h2></div>}
          </div>
        )}

        {tab === "claims" && (
          <div className="stack">
            {claims.length ? claims.map((claim) => (
              <article className="card" key={claim.id}>
                <div className="flex-between">
                  <h3>{claim.organName}</h3>
                  <span className={`status-pill ${claim.status}`}>{claim.status}</span>
                </div>
                <p>{claim.note}</p>
                {claim.adminNote && <div className="message"><strong>Administrator note:</strong> {claim.adminNote}</div>}
              </article>
            )) : (
              <div className="empty-state">
                <h2>No claim requests</h2>
                <p>Open an unclaimed listing to request ownership.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export default function OrganizationDashboard() {
  return <AuthGate role="organization"><Console /></AuthGate>;
}
