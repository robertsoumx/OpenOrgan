"use client";

import { useEffect, useState } from "react";
import { authenticatedFetch } from "@/lib/api-client";
import { toUserMessage } from "@/lib/user-error";
import { useAuth } from "@/components/AuthProvider";

export default function AdminClaimsClient() {
  const { user, isAdmin, loading } = useAuth();
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState({});
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  async function load() {
    if (!user || !isAdmin) return;

    try {
      const data = await authenticatedFetch("/api/admin/claims");
      setItems(data.items || []);
      setMessage("");
    } catch (error) {
      setMessage(toUserMessage(error));
    }
  }

  useEffect(() => {
    if (!loading && user && isAdmin) load();
  }, [loading, user?.uid, isAdmin]);

  async function decide(id, status) {
    setWorking(true);
    try {
      const data = await authenticatedFetch("/api/admin/claims", {
        method: "POST",
        body: JSON.stringify({
          id,
          status,
          note: notes[id] || ""
        })
      });
      setMessage(data.message || "Decision saved.");
      await load();
    } catch (error) {
      setMessage(toUserMessage(error));
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="section">
      <div className="container">
        <div className="page-header">
          <span className="eyebrow">Administrator</span>
          <h1>Listing claims</h1>
        </div>

        {message && <div className="message">{message}</div>}

        {items.length === 0 && !message ? (
          <div className="empty-state">
            <h2>No pending claims</h2>
            <p>New unclaimed-listing requests will appear here.</p>
          </div>
        ) : (
          <div className="stack">
            {items.map((item) => (
              <article className="card stack" key={item.id}>
                <div className="flex-between">
                  <div>
                    <h2>{item.organName}</h2>
                    <p>{item.organizationName}</p>
                  </div>
                  <span className={`status-pill ${item.status}`}>
                    {item.status}
                  </span>
                </div>

                {item.note && <p>{item.note}</p>}

                <textarea
                  placeholder="Administrator note"
                  value={notes[item.id] || ""}
                  onChange={(event) =>
                    setNotes((current) => ({
                      ...current,
                      [item.id]: event.target.value
                    }))
                  }
                />

                <div className="form-actions">
                  <button
                    className="button"
                    disabled={working}
                    onClick={() => decide(item.id, "approved")}
                  >
                    Approve Claim
                  </button>
                  <button
                    className="button-danger"
                    disabled={working}
                    onClick={() => decide(item.id, "rejected")}
                  >
                    Reject
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
