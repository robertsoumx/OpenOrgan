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
  where
} from "firebase/firestore";
import AuthGate from "@/components/AuthGate";
import { useAuth } from "@/components/AuthProvider";
import { db } from "@/lib/firebase-client";
import ReservationCard from "@/components/ReservationCard";
import { formatDateTime } from "@/lib/format";
import { toUserMessage } from "@/lib/user-error";

function Dashboard() {
  const { user, profile } = useAuth();
  const [reservations, setReservations] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [signups, setSignups] = useState([]);
  const [events, setEvents] = useState({});
  const [tab, setTab] = useState("reservations");
  const [notice, setNotice] = useState({ type: "", text: "" });

  async function load() {
    if (!db || !user) return;

    const [reservationSnapshot, questionSnapshot, signupSnapshot] = await Promise.all([
      getDocs(query(collection(db, "reservations"), where("userId", "==", user.uid))),
      getDocs(query(collection(db, "questions"), where("askerId", "==", user.uid))),
      getDocs(query(collection(db, "eventSignups"), where("userId", "==", user.uid)))
    ]);

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

    const signupItems = signupSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    setSignups(signupItems);

    const eventMap = {};
    await Promise.all([...new Set(signupItems.map((item) => item.eventId))].map(async (id) => {
      const snapshot = await getDoc(doc(db, "events", id)).catch(() => null);
      if (snapshot?.exists()) eventMap[id] = { id: snapshot.id, ...snapshot.data() };
    }));
    setEvents(eventMap);
  }

  useEffect(() => {
    load().catch((error) => {
      setNotice({
        type: "error",
        text: toUserMessage(error, "We could not load your dashboard. Try again.")
      });
    });
  }, [user?.uid]);

  async function readQuestion(question) {
    if (question.status !== "answered" || question.readByAsker) return;
    try {
      await updateDoc(doc(db, "questions", question.id), {
        readByAsker: true,
        updatedAt: serverTimestamp()
      });
      await load();
    } catch (error) {
      setNotice({
        type: "error",
        text: toUserMessage(error, "We could not mark this answer as read.")
      });
    }
  }

  async function cancelSignup(signup) {
    try {
      await deleteDoc(doc(db, "eventSignups", signup.id));
      setNotice({ type: "success", text: "Event signup cancelled." });
      await load();
    } catch (error) {
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
          <span className="eyebrow">Organist dashboard</span>
          <h1>Hello, {firstName}</h1>
          <p>Manage practice requests, questions, events, and your trust profile.</p>
          <div className="form-actions">
            <Link className="button-secondary" href="/profile">Edit Profile</Link>
            <Link className="button-secondary" href={`/profiles/${user.uid}`}>View Trust Profile</Link>
          </div>
        </div>

        {notice.text && (
          <div className={`message ${notice.type}`} role={notice.type === "error" ? "alert" : "status"}>
            {notice.text}
          </div>
        )}

        <div className="tabs">
          <button className={tab === "reservations" ? "active" : ""} onClick={() => setTab("reservations")}>
            Reservations ({reservations.length})
          </button>
          <button className={tab === "questions" ? "active" : ""} onClick={() => setTab("questions")}>
            Questions {unread ? `(${unread} new)` : ""}
          </button>
          <button className={tab === "events" ? "active" : ""} onClick={() => setTab("events")}>
            Event Signups ({signups.length})
          </button>
        </div>

        {tab === "reservations" && (
          <div className="stack">
            {reservations.length ? reservations.map((reservation) => (
              <ReservationCard
                key={reservation.id}
                reservation={reservation}
                viewerRole="organist"
                viewerId={user.uid}
                onChanged={load}
              />
            )) : (
              <div className="empty-state">
                <h2>No reservations yet</h2>
                <Link className="button" href="/search">Find an Organ</Link>
              </div>
            )}
          </div>
        )}

        {tab === "questions" && (
          <div className="stack">
            {questions.length ? questions.map((question) => (
              <article
                className={`card question-card ${question.status === "answered" && !question.readByAsker ? "unread" : ""}`}
                key={question.id}
                onClick={() => readQuestion(question)}
              >
                <div className="flex-between">
                  <strong>{question.targetType === "organ" ? "Organ question" : "Event question"}</strong>
                  <span className={`status-pill ${question.status}`}>{question.status}</span>
                </div>
                <p>{question.question}</p>
                {question.answer && <div className="question-answer">{question.answer}</div>}
                {question.status === "answered" && !question.readByAsker && <span className="badge">New answer</span>}
                <div>
                  <Link href={`/${question.targetType === "organ" ? "organs" : "events"}/${question.targetId}`}>
                    Open listing
                  </Link>
                </div>
              </article>
            )) : <div className="empty-state"><h2>No questions yet</h2></div>}
          </div>
        )}

        {tab === "events" && (
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
            }) : (
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
