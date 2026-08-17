"use client";

import { useEffect, useState } from "react";
import { authenticatedFetch } from "@/lib/api-client";
import { toUserMessage } from "@/lib/user-error";
import { useAuth } from "@/components/AuthProvider";

export default function AdminVerificationsClient() {
  const { user, isAdmin, loading } = useAuth();
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState({});
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  async function load() {
    if (!user || !isAdmin) return;

    try {
      const data = await authenticatedFetch("/api/admin/verifications");
      setItems(data.items || []);
      setMessage("");
    } catch (error) {
      setMessage(toUserMessage(error));
    }
  }

  useEffect(() => {
    if (!loading && user && isAdmin) load();
  }, [loading, user?.uid, isAdmin]);

  async function decide(uid, status) {
    setWorking(true);
    try {
      const data = await authenticatedFetch("/api/admin/verifications", {
        method: "POST",
        body: JSON.stringify({
          uid,
          status,
          note: notes[uid] || ""
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
          <h1>Organization verifications</h1>
        </div>

        {message && <div className="message">{message}</div>}

        {items.length === 0 && !message ? (
          <div className="empty-state">
            <h2>No verification requests</h2>
            <p>Pending organization verification requests will appear here.</p>
          </div>
        ) : (
          <div className="stack">
            {items.map((item) => (
              <article className="card stack" key={item.uid}>
                <div className="flex-between">
                  <div>
                    <h2>
                      {item.profile?.organizationName ||
                        item.profile?.displayName ||
                        item.email}
                    </h2>
                    <p>
                      {[item.verificationWebsite, item.verificationEmail]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <span className={`status-pill ${item.verificationStatus}`}>
                    {item.verificationStatus}
                  </span>
                </div>

                <textarea
                  placeholder="Administrator note"
                  value={notes[item.uid] || ""}
                  onChange={(event) =>
                    setNotes((current) => ({
                      ...current,
                      [item.uid]: event.target.value
                    }))
                  }
                />

                <div className="form-actions">
                  <button
                    className="button"
                    disabled={working}
                    onClick={() => decide(item.uid, "verified")}
                  >
                    Verify
                  </button>
                  <button
                    className="button-danger"
                    disabled={working}
                    onClick={() => decide(item.uid, "rejected")}
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
