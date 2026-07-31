"use client";
import { toUserMessage } from "@/lib/user-error";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where
} from "firebase/firestore";
import { db } from "@/lib/firebase-client";
import { useAuth } from "@/components/AuthProvider";

export default function QuestionsSection({ targetType, targetId, ownerId, enabled = true }) {
  const { user, account, profile } = useAuth();
  const [questions, setQuestions] = useState([]);
  const [question, setQuestion] = useState("");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  const canAsk = Boolean(user && account?.role === "organist");
  const isOwner = Boolean(user?.uid && user.uid === ownerId && account?.role === "organization");

  async function load() {
    if (!db || !targetId) return;

    const requests = [
      getDocs(query(collection(db, "questions"), where("targetId", "==", targetId), where("status", "==", "answered")))
    ];

    if (user?.uid) {
      requests.push(getDocs(query(collection(db, "questions"), where("askerId", "==", user.uid))));
    }

    if (user?.uid === ownerId) {
      requests.push(getDocs(query(collection(db, "questions"), where("ownerId", "==", user.uid))));
    }

    const snapshots = await Promise.all(requests);
    const unique = new Map();

    for (const snapshot of snapshots) {
      for (const item of snapshot.docs) {
        const data = { id: item.id, ...item.data() };
        if (data.targetId === targetId) unique.set(item.id, data);
      }
    }

    setQuestions([...unique.values()]);
  }

  useEffect(() => {
    load().catch(() => {});
  }, [targetId, user?.uid]);

  async function submit(event) {
    event.preventDefault();
    if (!canAsk || !enabled) return;
    if (question.trim().length < 5) {
      setMessage("Write a more specific question.");
      return;
    }

    setWorking(true);
    setMessage("");

    try {
      await addDoc(collection(db, "questions"), {
        targetType,
        targetId,
        ownerId,
        askerId: user.uid,
        askerName: profile?.displayName || user.displayName || "OpenOrgan user",
        question: question.trim(),
        answer: "",
        status: "open",
        readByAsker: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setQuestion("");
      setMessage("Question sent.");
      await load();
    } catch (error) {
      setMessage(toUserMessage(error, "Unable to send the question."));
    } finally {
      setWorking(false);
    }
  }

  const answered = questions.filter((item) => item.status === "answered");
  const detailPath = `/${targetType === "organ" ? "organs" : "events"}/${targetId}`;

  return (
    <section className="card stack-lg">
      <div>
        <span className="eyebrow">Questions and answers</span>
        <h2>Ask the host</h2>
      </div>

      {answered.length ? (
        answered.map((item) => (
          <article className="question-card" key={item.id}>
            <p>
              <strong>{item.askerName}:</strong> {item.question}
            </p>
            <div className="question-answer">{item.answer}</div>
          </article>
        ))
      ) : (
        <p className="muted">No public questions have been answered yet.</p>
      )}

      {!enabled ? (
        <div className="message warning">
          Q&amp;A becomes available after this listing is claimed and published.
        </div>
      ) : canAsk ? (
        <form className="stack" onSubmit={submit}>
          <label>
            Your question
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask about access, availability, the instrument, or the event."
            />
          </label>
          <button className="button" disabled={working}>
            {working ? "Sending..." : "Ask Question"}
          </button>
        </form>
      ) : !user ? (
        <p className="muted">
          <Link href={`/login?next=${detailPath}`}>Sign in with an organist account</Link> to ask a question.
        </p>
      ) : isOwner ? (
        <p className="muted">
          Answer incoming questions from your <Link href="/organization">organization dashboard</Link>.
        </p>
      ) : null}

      {message && <div className="message">{message}</div>}
    </section>
  );
}
