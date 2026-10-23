"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { authenticatedFetch } from "@/lib/api-client";
import { PRIVACY_REQUEST_TYPES, PRIVACY_REQUEST_STATUSES } from "@/lib/privacy-core.mjs";
import { formatDateTime } from "@/lib/format";
import { toUserMessage } from "@/lib/user-error";

export default function PrivacyRequests({ admin = false }) {
  const { user, isAdmin, loading } = useAuth();
  if (loading) return <p role="status">Checking your account...</p>;
  if (!user) return <p><Link href="/login?next=/privacy%23requests">Sign in to submit and read private requests</Link>.</p>;
  if (admin && !isAdmin) return <p role="alert">Administrator access is required.</p>;
  return <RequestsBody key={user.uid + ":" + admin} admin={admin} user={user} isAdmin={isAdmin}/>;
}

function RequestsBody({ admin, user, isAdmin }) {
  const [items, setItems] = useState([]), [filter, setFilter] = useState("active"), [fetching, setFetching] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [type, setType] = useState("access"), [details, setDetails] = useState(""), [drafts, setDrafts] = useState({}), [working, setWorking] = useState("");
  const version = useRef(0), mutation = useRef(0), alive = useRef(false);
  const endpoint = admin ? "/api/admin/privacy" : "/api/privacy/requests";
  const allowed = Boolean(user && (!admin || isAdmin));
  const load = useCallback(async () => {
    if (!allowed) return;
    const current = ++version.current;
    setFetching(true); setError("");
    try {
      const data = await authenticatedFetch(endpoint + (admin ? "?status=" + filter : ""));
      if (alive.current && current === version.current) { setItems(data.items || []); setDrafts({}); }
    } catch (issue) { if (alive.current && current === version.current) setError(toUserMessage(issue)); }
    finally { if (alive.current && current === version.current) setFetching(false); }
  }, [allowed, user?.uid, endpoint, admin, filter]);
  useEffect(() => { alive.current = true; mutation.current++; setWorking(""); setItems([]); setDrafts({}); setNotice(""); setDetails(""); load(); return () => { alive.current = false; version.current++; mutation.current++; }; }, [load]);

  async function submit(event, item = null) {
    event.preventDefault();
    if (working || !allowed) return;
    const current = ++mutation.current;
    setWorking(item?.id || "new"); setNotice(""); setError("");
    try {
      const payload = item ? { id: item.id, expectedUpdatedAt: item.updatedAt, status: drafts[item.id]?.status || item.status, reply: drafts[item.id]?.reply ?? item.reply } : { type, details };
      const data = await authenticatedFetch(endpoint, { method: "POST", body: JSON.stringify(payload) });
      if (!alive.current || current !== mutation.current) return;
      setNotice(data.message); if (!item) setDetails("");
      await load();
    } catch (issue) { if (alive.current && current === mutation.current) setError(toUserMessage(issue)); }
    finally { if (alive.current && current === mutation.current) setWorking(""); }
  }
  function draft(id, changes) { setDrafts(current => ({ ...current, [id]: { ...current[id], ...changes } })); }

  return <div className="stack-lg privacy-requests">
    {!admin && <form className="stack" onSubmit={submit}><label>Request type<select value={type} onChange={event => setType(event.target.value)}>{Object.entries(PRIVACY_REQUEST_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Request details<textarea minLength={5} maxLength={2000} value={details} onChange={event => setDetails(event.target.value)} required/></label><p className="small">Include only what we need to identify the data; do not send passwords, payment details, or identity documents.</p><button className="button" disabled={Boolean(working)}>{working === "new" ? "Sending..." : "Send private request"}</button></form>}
    {admin && <label>Show requests<select value={filter} onChange={event => setFilter(event.target.value)}><option value="active">Received and in review</option><option value="closed">Recent closed requests</option></select></label>}
    {notice && <p className="message success" role="status">{notice}</p>}{error && <p className="message error" role="alert">{error}</p>}
    <div className="flex-between"><h3>{admin ? "Requests" : "Your recent requests"}</h3><button type="button" className="button-secondary" disabled={fetching || Boolean(working)} onClick={load}>{fetching ? "Refreshing..." : "Refresh"}</button></div>
    {fetching && <p role="status">Loading requests...</p>}
    {!fetching && !error && !items.length && <p>No requests to show.</p>}
    {items.map(item => <article className="privacy-request" key={item.id}><div className="flex-between"><h3>{PRIVACY_REQUEST_TYPES[item.type] || "Privacy request"}</h3><span>{PRIVACY_REQUEST_STATUSES[item.status]}</span></div><p className="small">{formatDateTime(item.createdAt)}{admin ? " · Account " + item.userId : ""}</p><p className="preserve-lines">{item.details}</p>{item.reply && <div className="privacy-reply"><strong>Administrator reply</strong><p className="preserve-lines">{item.reply}</p></div>}{admin && <form className="stack" onSubmit={event => submit(event, item)}><label>Private reply<textarea maxLength={2000} value={drafts[item.id]?.reply ?? item.reply} onChange={event => draft(item.id, { reply: event.target.value })}/></label><label>Status<select value={drafts[item.id]?.status || item.status} onChange={event => draft(item.id, { status: event.target.value })}>{Object.entries(PRIVACY_REQUEST_STATUSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><p className="small">Closing a request records your response; account or data deletion must be completed separately before confirming it here.</p><button className="button" disabled={Boolean(working)}>{working === item.id ? "Saving..." : "Save private response"}</button></form>}</article>)}
  </div>;
}
