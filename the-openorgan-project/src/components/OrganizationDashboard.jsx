"use client";

import { useEffect, useRef, useState } from "react";
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
import { getTimeZone } from "@/lib/time-zones.mjs";
import { toUserMessage } from "@/lib/user-error";

const sections = { organs: "organs", events: "events", reservations: "reservations", questions: "questions", signups: "event signups", claims: "claim requests" };
function initialLoadState() {
  return Object.fromEntries(Object.keys(sections).map((key) => [key, { loaded: false, error: "" }]));
}

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
  const [loadState, setLoadState] = useState(initialLoadState);
  const [refreshing, setRefreshing] = useState(true);
  const [publishingAnswer, setPublishingAnswer] = useState("");
  const mounted = useRef(false), request = useRef(0), currentUser = useRef(user?.uid), feedback = useRef(null);
  currentUser.current = user?.uid;

  async function load() {
    const uid = user?.uid, version = ++request.current;
    const isCurrent = () => mounted.current && currentUser.current === uid && request.current === version;
    if (!uid || !isCurrent()) return;
    setRefreshing(true);
    if (!db) {
      setLoadState((current) => Object.fromEntries(Object.entries(current).map(([key, state]) => [key, { ...state, error: "Your dashboard is unavailable. Try again." }])));
      setRefreshing(false);
      return;
    }

    const results = await Promise.allSettled([
      getDocs(query(collection(db, "organs"), where("ownerId", "==", user.uid))),
      getDocs(query(collection(db, "events"), where("ownerId", "==", user.uid))),
      getDocs(query(collection(db, "reservations"), where("organizationOwnerId", "==", user.uid))),
      getDocs(query(collection(db, "questions"), where("ownerId", "==", user.uid))),
      getDocs(query(collection(db, "eventSignups"), where("eventOwnerId", "==", user.uid))),
      getDocs(query(collection(db, "claimRequests"), where("organizationId", "==", user.uid)))
    ]);
    if (!isCurrent()) return;
    const rows = (snapshot) => snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    const newestFirst = (snapshot) => rows(snapshot).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    const setters = [setOrgans, setEvents, setReservations, setQuestions, null, setClaims];
    results.forEach((result, index) => {
      if (result.status === "fulfilled" && setters[index]) setters[index]([2, 3].includes(index) ? newestFirst(result.value) : rows(result.value));
    });
    const nextState = Object.fromEntries(Object.keys(sections).map((key, index) => [key, results[index].status === "fulfilled"
      ? { loaded: true, error: "" }
      : { error: toUserMessage(results[index].reason, `We could not load your ${sections[key]}. Try again.`) }]));
    setLoadState((current) => Object.fromEntries(Object.keys(sections).map((key) => [key, { ...current[key], ...nextState[key] }])));
    const eventItems = results[1].status === "fulfilled" ? rows(results[1].value) : events;
    const eventMap = new Map(eventItems.map((item) => [item.id, item]));
    if (results[4].status === "fulfilled") {
      const signupItems = rows(results[4].value);
      setSignups(signupItems.map((item) => ({ ...item, event: eventMap.get(item.eventId) || null, contactEmail: "" })));
      const contacts = await Promise.allSettled([...new Set(signupItems.map((item) => item.userId))].map(async (id) => ({ id, snapshot: await getDoc(doc(db, "publicContacts", id)) })));
      if (!isCurrent()) return;
      const contactMap = new Map();
      contacts.forEach((result) => {
        if (result.status !== "fulfilled") return;
        const { id, snapshot } = result.value;
        if (snapshot.exists() && snapshot.data().visible) contactMap.set(id, snapshot.data().email);
      });
      setSignups(signupItems.map((item) => ({ ...item, event: eventMap.get(item.eventId) || null, contactEmail: contactMap.get(item.userId) || "" })));
      if (contacts.some((result) => result.status === "rejected" && !["permission-denied", "firestore/permission-denied"].includes(result.reason?.code))) nextState.signups.error = "Some attendee contact details could not be loaded. Try again.";
    } else if (results[1].status === "fulfilled") {
      setSignups((current) => current.map((item) => ({ ...item, event: eventMap.get(item.eventId) || null })));
    }
    setLoadState((current) => Object.fromEntries(Object.keys(sections).map((key) => [key, { ...current[key], ...nextState[key] }])));
    setRefreshing(false);
  }

  useEffect(() => {
    mounted.current = true;
    setOrgans([]); setEvents([]); setReservations([]); setQuestions([]); setSignups([]); setClaims([]);
    setNotice({ type: "", text: "" }); setAnswers({}); setPublishingAnswer("");
    setCreatingOrgan(false); setCreatingEvent(false); setEditingOrgan(null); setEditingEvent(null);
    setLoadState(initialLoadState());
    load();
    return () => { mounted.current = false; request.current += 1; };
  }, [user?.uid]);
  useEffect(() => { if (notice.text) feedback.current?.focus(); }, [notice]);

  async function answer(question) {
    const value = answers[question.id]?.trim();
    if (!value) return;
    const uid = user.uid;
    setPublishingAnswer(question.id);

    try {
      await updateDoc(doc(db, "questions", question.id), {
        answer: value,
        status: "answered",
        readByAsker: false,
        answeredAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      if (!mounted.current || currentUser.current !== uid) return;
      setAnswers((current) => ({ ...current, [question.id]: "" }));
      setNotice({ type: "success", text: "Answer published. The user has a dashboard notification." });
      await load();
    } catch (error) {
      if (!mounted.current || currentUser.current !== uid) return;
      setNotice({
        type: "error",
        text: toUserMessage(error, "We could not publish the answer. Try again.")
      });
    } finally {
      if (mounted.current && currentUser.current === uid) setPublishingAnswer("");
    }
  }

  async function removeDocument(collectionName, id, label) {
    if (!window.confirm(`Delete this ${label}?`)) return;
    const uid = user.uid;

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
      if (!mounted.current || currentUser.current !== uid) return;
      setNotice({ type: "success", text: `${label} deleted.` });
      await load();
    } catch (error) {
      if (!mounted.current || currentUser.current !== uid) return;
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
    ["organs", `Organs${loadState.organs.loaded ? ` (${organs.length})` : ""}`],
    ["events", `Events${loadState.events.loaded ? ` (${events.length})` : ""}`],
    ["reservations", `Reservations${loadState.reservations.loaded ? ` (${reservations.length})` : ""}`],
    ["questions", `Questions${loadState.questions.loaded ? ` (${questions.filter((item) => item.status === "open").length})` : ""}`],
    ["signups", `Event Signups${loadState.signups.loaded ? ` (${signups.length})` : ""}`],
    ["claims", `Claims${loadState.claims.loaded ? ` (${claims.length})` : ""}`]
  ];

  return (
    <section className="section">
      <div className="container">
        <div className="page-header">
          <h1>{profile?.organizationName || "Your institution"}</h1>
          <p>Offer free or paid practice access, review requests, and publish events.</p>
          <div className="form-actions"><Link className="button-secondary" href="/guide">User guide</Link>
            <Link className="button-secondary" href="/profile">Edit institution profile</Link>
            <button className="button-secondary" disabled={refreshing} onClick={load}>{refreshing ? "Refreshing…" : "Refresh dashboard"}</button>
          </div>
        </div>

        <div className={account?.verificationStatus === "verified" ? "verification-status" : "message warning"}>
          {account?.verificationStatus === "verified" ? <p>Institution verified · Publishing enabled</p> : <><strong>Verification: {account?.verificationStatus?.replaceAll("_", " ")}</strong><div>{verificationText}</div></>}
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
            <button key={value} aria-pressed={tab === value} className={tab === value ? "active" : ""} onClick={() => setTab(value)}>
              {label}
            </button>
          ))}
        </div>

        {notice.text && (
          <div className={`message ${notice.type}`} role={notice.type === "error" ? "alert" : "status"} ref={feedback} tabIndex={-1}>
            {notice.text}
          </div>
        )}

        {refreshing && <p className="dashboard-loading" role="status">{Object.values(loadState).some((state) => state.loaded) ? "Updating your dashboard…" : "Loading your dashboard…"}</p>}
        {(tab === "overview" ? Object.keys(sections) : [tab]).filter((key) => loadState[key].error).map((key) => <div className="dashboard-retry" role="alert" key={key}><p>{loadState[key].error}{loadState[key].loaded ? " Showing previously loaded information." : ""}</p><button className="button-secondary" disabled={refreshing} onClick={load}>Retry {sections[key]}</button></div>)}

        {tab === "overview" && (
          <div className="dashboard-shortcuts">
            <button className="dashboard-action" onClick={() => setTab("organs")}><strong>Offer practice access</strong><span>{loadState.organs.loaded ? `${organs.length} organ${organs.length === 1 ? "" : "s"}` : loadState.organs.error ? "Listings unavailable · Retry" : "Loading listings…"}</span></button>
            <button className="dashboard-action" onClick={() => setTab("reservations")}><strong>Review practice requests</strong><span>{loadState.reservations.loaded ? `${reservations.filter((item) => item.status === "pending").length} pending` : loadState.reservations.error ? "Requests unavailable · Retry" : "Loading requests…"}</span></button>
            <button className="dashboard-action" onClick={() => setTab("events")}><strong>Publish events</strong><span>{loadState.events.loaded ? `${events.length} event${events.length === 1 ? "" : "s"}` : loadState.events.error ? "Events unavailable · Retry" : "Loading events…"}</span></button>
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
                  setNotice({ type: "success", text: "Organ saved." });
                  await load();
                }}
                onCancel={() => { setCreatingOrgan(false); setEditingOrgan(null); }}
              />
            )}

            <div className="stack">
              {loadState.organs.loaded && (organs.length ? organs.map((organ) => (
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
              )) : !creatingOrgan && !loadState.organs.error ? (
                <div className="empty-state">
                  <h2>No organs yet</h2>
                  <p>List an organ and choose free access, a recommended donation, or a required fee.</p>
                  <button className="button" onClick={() => { setCreatingOrgan(true); setEditingOrgan(null); }}>Add Organ</button>
                </div>
              ) : null)}
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
                  setNotice({ type: "success", text: "Event saved." });
                  await load();
                }}
                onCancel={() => { setCreatingEvent(false); setEditingEvent(null); }}
              />
            )}

            <div className="stack">
              {loadState.events.loaded && (events.length ? events.map((event) => (
                <article className="card flex-between" key={event.id}>
                  <div>
                    <h3>{event.title}</h3>
                    <p className="muted">{formatDateTime(event.startDateTime, getTimeZone(event))} · {event.status}</p>
                    <Link href={`/events/${event.id}`}>View public page</Link>
                  </div>
                  <div className="form-actions">
                    <button className="button-secondary" onClick={() => { setEditingEvent(event); setCreatingEvent(false); }}>Edit</button>
                    <button className="button-danger" onClick={() => removeDocument("events", event.id, "event")}>Delete</button>
                  </div>
                </article>
              )) : !creatingEvent && !loadState.events.error ? (
                <div className="empty-state">
                  <h2>No events yet</h2>
                  <p>Publish a concert, service, or workshop so people can find it in Find events.</p>
                  <button className="button" onClick={() => { setCreatingEvent(true); setEditingEvent(null); }}>Add Event</button>
                </div>
              ) : null)}
            </div>
          </div>
        )}

        {tab === "reservations" && loadState.reservations.loaded && (
          <div className="stack">
            {reservations.length ? reservations.map((reservation) => (
              <ReservationCard
                key={reservation.id}
                reservation={reservation}
                viewerRole="organization"
                viewerId={user.uid}
                onChanged={load}
              />
            )) : !loadState.reservations.error && <div className="empty-state"><h2>No reservation requests</h2></div>}
          </div>
        )}

        {tab === "questions" && loadState.questions.loaded && (
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
                    <label>Answer for {question.askerName || "the organist"}<textarea
                      value={answers[question.id] || ""}
                      onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))}
                      placeholder="Write an answer"
                    /></label>
                    <button className="button" disabled={publishingAnswer === question.id || !answers[question.id]?.trim()} onClick={() => answer(question)}>{publishingAnswer === question.id ? "Publishing…" : "Publish Answer"}</button>
                  </>
                )}
              </article>
            )) : !loadState.questions.error && <div className="empty-state"><h2>No questions</h2></div>}
          </div>
        )}

        {tab === "signups" && loadState.signups.loaded && (
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
            )) : !loadState.signups.error && <div className="empty-state"><h2>No event signups</h2></div>}
          </div>
        )}

        {tab === "claims" && loadState.claims.loaded && (
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
            )) : loadState.claims.error ? null : (
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
