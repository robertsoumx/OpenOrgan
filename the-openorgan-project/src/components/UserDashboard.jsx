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
  where
} from "firebase/firestore";
import AuthGate from "@/components/AuthGate";
import { useAuth } from "@/components/AuthProvider";
import { db } from "@/lib/firebase-client";
import ReservationCard from "@/components/ReservationCard";
import { formatDateTime } from "@/lib/format";
import { toUserMessage } from "@/lib/user-error";

const sections = { reservations: "reservations", questions: "questions", events: "event signups" };
function initialLoadState() {
  return Object.fromEntries(Object.keys(sections).map((key) => [key, { loaded: false, error: "" }]));
}

function Dashboard() {
  const { user, profile } = useAuth();
  const [reservations, setReservations] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [signups, setSignups] = useState([]);
  const [events, setEvents] = useState({});
  const [tab, setTab] = useState("reservations");
  const [notice, setNotice] = useState({ type: "", text: "" });
  const [loadState, setLoadState] = useState(initialLoadState);
  const [refreshing, setRefreshing] = useState(true);
  const [readingQuestion, setReadingQuestion] = useState("");
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
      getDocs(query(collection(db, "reservations"), where("userId", "==", user.uid))),
      getDocs(query(collection(db, "questions"), where("askerId", "==", user.uid))),
      getDocs(query(collection(db, "eventSignups"), where("userId", "==", user.uid)))
    ]);
    if (!isCurrent()) return;
    const [reservationResult, questionResult, signupResult] = results;
    const rows = (snapshot) => snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    const newestFirst = (snapshot) => rows(snapshot).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    if (reservationResult.status === "fulfilled") setReservations(newestFirst(reservationResult.value));
    if (questionResult.status === "fulfilled") setQuestions(newestFirst(questionResult.value));
    const nextState = Object.fromEntries(Object.keys(sections).map((key, index) => [key, results[index].status === "fulfilled"
      ? { loaded: true, error: "" }
      : { error: toUserMessage(results[index].reason, `We could not load your ${sections[key]}. Try again.`) }]));
    setLoadState((current) => Object.fromEntries(Object.keys(sections).map((key) => [key, { ...current[key], ...nextState[key] }])));

    if (signupResult.status === "fulfilled") {
      const signupItems = rows(signupResult.value);
      setSignups(signupItems);
      const details = await Promise.allSettled([...new Set(signupItems.map((item) => item.eventId))].map(async (id) => ({ id, snapshot: await getDoc(doc(db, "events", id)) })));
      if (!isCurrent()) return;
      setEvents((current) => {
        const updated = { ...current };
        details.forEach((result) => {
          if (result.status !== "fulfilled") return;
          const { id, snapshot } = result.value;
          if (snapshot.exists()) updated[id] = { id: snapshot.id, ...snapshot.data() };
          else delete updated[id];
        });
        return updated;
      });
      if (details.some((result) => result.status === "rejected")) nextState.events.error = "Some event details could not be loaded. Try again.";
    }
    setLoadState((current) => Object.fromEntries(Object.keys(sections).map((key) => [key, { ...current[key], ...nextState[key] }])));
    setRefreshing(false);
  }

  useEffect(() => {
    mounted.current = true;
    setReservations([]); setQuestions([]); setSignups([]); setEvents({});
    setNotice({ type: "", text: "" }); setReadingQuestion("");
    setLoadState(initialLoadState());
    load();
    return () => { mounted.current = false; request.current += 1; };
  }, [user?.uid]);
  useEffect(() => { if (notice.text) feedback.current?.focus(); }, [notice]);

  async function readQuestion(question) {
    if (question.status !== "answered" || question.readByAsker) return;
    const uid = user.uid;
    setReadingQuestion(question.id);
    try {
      await updateDoc(doc(db, "questions", question.id), {
        readByAsker: true,
        updatedAt: serverTimestamp()
      });
      if (!mounted.current || currentUser.current !== uid) return;
      setNotice({ type: "success", text: "Answer marked as read." });
      await load();
    } catch (error) {
      if (!mounted.current || currentUser.current !== uid) return;
      setNotice({
        type: "error",
        text: toUserMessage(error, "We could not mark this answer as read.")
      });
    } finally {
      if (mounted.current && currentUser.current === uid) setReadingQuestion("");
    }
  }

  async function cancelSignup(signup) {
    const uid = user.uid;
    try {
      await deleteDoc(doc(db, "eventSignups", signup.id));
      if (!mounted.current || currentUser.current !== uid) return;
      setNotice({ type: "success", text: "Event signup cancelled." });
      await load();
    } catch (error) {
      if (!mounted.current || currentUser.current !== uid) return;
      setNotice({
        type: "error",
        text: toUserMessage(error, "We could not cancel the event signup.")
      });
    }
  }

  const unread = questions.filter((item) => item.status === "answered" && !item.readByAsker).length;
  const firstName = String(profile?.displayName || user.displayName || "Organist").trim().split(/\s+/)[0] || "Organist";

  return (
    <section className="section">
      <div className="container">
        <div className="page-header">
          <h1>Hello, {firstName}</h1>
          <p>Manage practice requests, questions, events, and your profile.</p>
          <div className="form-actions"><Link className="button-secondary" href="/guide">User guide</Link>
            <Link className="button-secondary" href="/profile">Edit Profile</Link>
            <Link className="button-secondary" href={`/profiles/${user.uid}`}>View public profile</Link>
            <button className="button-secondary" disabled={refreshing} onClick={load}>{refreshing ? "Refreshing…" : "Refresh dashboard"}</button>
          </div>
        </div>

        {notice.text && (
          <div className={`message ${notice.type}`} role={notice.type === "error" ? "alert" : "status"} ref={feedback} tabIndex={-1}>
            {notice.text}
          </div>
        )}

        <div className="tabs">
          <button aria-pressed={tab === "reservations"} className={tab === "reservations" ? "active" : ""} onClick={() => setTab("reservations")}>
            Reservations{loadState.reservations.loaded ? ` (${reservations.length})` : ""}
          </button>
          <button aria-pressed={tab === "questions"} className={tab === "questions" ? "active" : ""} onClick={() => setTab("questions")}>
            Questions {unread ? `(${unread} new)` : ""}
          </button>
          <button aria-pressed={tab === "events"} className={tab === "events" ? "active" : ""} onClick={() => setTab("events")}>
            Event Signups{loadState.events.loaded ? ` (${signups.length})` : ""}
          </button>
        </div>

        {refreshing && <p className="dashboard-loading" role="status">{loadState[tab].loaded ? "Updating your dashboard…" : `Loading your ${sections[tab]}…`}</p>}
        {loadState[tab].error && <div className="dashboard-retry" role="alert"><p>{loadState[tab].error}{loadState[tab].loaded ? " Showing previously loaded information." : ""}</p><button className="button-secondary" disabled={refreshing} onClick={load}>Try again</button></div>}

        {tab === "reservations" && loadState.reservations.loaded && (
          <div className="stack">
            {reservations.length ? reservations.map((reservation) => (
              <ReservationCard
                key={reservation.id}
                reservation={reservation}
                viewerRole="organist"
                viewerId={user.uid}
                onChanged={load}
              />
            )) : loadState.reservations.error ? null : (
              <div className="empty-state">
                <h2>No reservations yet</h2>
                <Link className="button" href="/search">Find an Organ</Link>
              </div>
            )}
          </div>
        )}

        {tab === "questions" && loadState.questions.loaded && (
          <div className="stack">
            {questions.length ? questions.map((question) => (
              <article
                className={`card question-card ${question.status === "answered" && !question.readByAsker ? "unread" : ""}`}
                key={question.id}
              >
                <div className="flex-between">
                  <strong>{question.targetType === "organ" ? "Organ question" : "Event question"}</strong>
                  <span className={`status-pill ${question.status}`}>{question.status}</span>
                </div>
                <p>{question.question}</p>
                {question.answer && <div className="question-answer">{question.answer}</div>}
                {question.status === "answered" && !question.readByAsker && <div className="form-actions"><span className="badge">New answer</span><button className="button-secondary" disabled={readingQuestion === question.id} onClick={() => readQuestion(question)}>{readingQuestion === question.id ? "Marking as read…" : "Mark answer as read"}</button></div>}
                <div>
                  <Link href={`/${question.targetType === "organ" ? "organs" : "events"}/${question.targetId}`}>
                    Open listing
                  </Link>
                </div>
              </article>
            )) : !loadState.questions.error && <div className="empty-state"><h2>No questions yet</h2></div>}
          </div>
        )}

        {tab === "events" && loadState.events.loaded && (
          <div className="stack">
            {signups.length ? signups.map((signup) => {
              const event = events[signup.eventId];
              return (
                <article className="card flex-between" key={signup.id}>
                  <div>
                    <h3>{event?.title || "Event"}</h3>
                    <p>{formatDateTime(event?.startDateTime)}</p>
                    {event && <Link href={`/events/${event.id}`}>View event</Link>}
                  </div>
                  <button className="button-danger" onClick={() => cancelSignup(signup)}>Cancel Signup</button>
                </article>
              );
            }) : loadState.events.error ? null : (
              <div className="empty-state">
                <h2>No event signups</h2>
                <Link className="button" href="/events">Browse Events</Link>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export default function UserDashboard() {
  return <AuthGate role="organist"><Dashboard /></AuthGate>;
}
