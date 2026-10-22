"use client";

import { useEffect, useRef, useState } from "react";
import { collection, doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase-client";
import { toUserMessage } from "@/lib/user-error";
import PlacePicker from "@/components/PlacePicker";
import PricingFields from "@/components/PricingFields";
import ImageUpload from "@/components/ImageUpload";

function empty(profile) {
  return { name: "", organizationName: profile?.organizationName || profile?.displayName || "", builder: "", year: "", manuals: "", stops: "", description: "", publicAccessNotes: "", internalAccessNotes: "", location: null, status: "draft", bookingEnabled: false, imageUrl: "", imagePath: "", pricing: { model: "free", amount: "", paymentTiming: "on_arrival", paymentMethods: [], instructions: "" } };
}

export default function OrganEditor({ user, account, profile, organ, onSaved, onCancel }) {
  const [form, setForm] = useState(() => empty(profile));
  const [message, setMessage] = useState({ type: "", text: "" });
  const [working, setWorking] = useState(false);
  const [loading, setLoading] = useState(Boolean(organ));
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const mounted = useRef(false), request = useRef(0), heading = useRef(null), feedback = useRef(null);

  useEffect(() => {
    mounted.current = true;
    const version = ++request.current;
    const isCurrent = () => mounted.current && version === request.current;
    setWorking(false);
    setMessage({ type: "", text: "" });
    setLoadError(false);
    async function load() {
      if (!organ) { setForm(empty(profile)); setLoading(false); return; }
      setLoading(true);
      try {
        if (!db) throw new Error("The listing is unavailable. Try again.");
        const snapshot = await getDoc(doc(db, "organPrivate", organ.id));
        if (!isCurrent()) return;
        const internalAccessNotes = snapshot.exists() ? snapshot.data().internalAccessNotes || "" : "";
        setForm({ ...empty(profile), ...organ, internalAccessNotes, pricing: { model: organ.pricing?.model || "free", amount: organ.pricing?.model === "free" ? "" : String(Number(organ.pricing?.amountCents || 0) / 100), paymentTiming: organ.pricing?.paymentTiming || "on_arrival", paymentMethods: organ.pricing?.paymentMethods || [], instructions: organ.pricing?.instructions || "" } });
      } catch (error) {
        if (!isCurrent()) return;
        setLoadError(true);
        setMessage({ type: "error", text: toUserMessage(error, "We could not load this listing's private notes. Try again before saving.") });
      } finally {
        if (isCurrent()) setLoading(false);
      }
    }
    load();
    return () => { mounted.current = false; request.current += 1; };
  }, [organ?.id, profile?.organizationName, attempt]);

  useEffect(() => { if (!loading && !loadError) heading.current?.focus(); }, [loading, loadError, organ?.id]);
  useEffect(() => { if (message.type === "error") feedback.current?.focus(); }, [message]);

  function patch(changes) { setForm((current) => ({ ...current, ...changes })); }
  function fail(text) { setMessage({ type: "error", text }); }

  async function save(event) {
    event.preventDefault();
    if (working || loading || loadError) return;
    if (!form.location?.placeId) return fail("Select the location from Google Maps.");
    const verified = account?.verificationStatus === "verified";
    if (form.status === "active" && !verified) return fail("Your organization must be manually verified before publishing.");
    const pricing = form.pricing || {};
    if (pricing.model !== "free") {
      if (!(Number(pricing.amount) > 0)) return fail("Enter a positive amount.");
      if (!(pricing.paymentMethods || []).length) return fail("Select at least one payment method.");
      if (!pricing.instructions?.trim()) return fail("Add payment instructions.");
    }
    const version = request.current;
    const isCurrent = () => mounted.current && version === request.current;
    setWorking(true);
    setMessage({ type: "", text: "" });
    try {
      const id = organ?.id || doc(collection(db, "organs")).id;
      const publicRef = doc(db, "organs", id), privateRef = doc(db, "organPrivate", id);
      const listingOwnership = organ?.listingOwnership || "claimed";
      const status = form.status === "active" && verified ? "active" : "draft";
      const data = {
        ownerId: user.uid, organizationName: form.organizationName.trim(), name: form.name.trim(), builder: form.builder.trim(), year: form.year.trim(), manuals: Number(form.manuals || 0), stops: Number(form.stops || 0), description: form.description.trim(), publicAccessNotes: form.publicAccessNotes.trim(), location: form.location, status,
        bookingEnabled: Boolean(form.bookingEnabled) && status === "active" && listingOwnership === "claimed", listingOwnership, claimStatus: listingOwnership === "claimed" ? "claimed" : organ?.claimStatus || "available", verificationStatus: verified ? "verified" : "unverified",
        pricing: { model: pricing.model || "free", amountCents: pricing.model === "free" ? 0 : Math.round(Number(pricing.amount) * 100), currency: "USD", paymentTiming: pricing.model === "free" ? "" : pricing.paymentTiming, paymentMethods: pricing.model === "free" ? [] : pricing.paymentMethods || [], instructions: pricing.model === "free" ? "" : pricing.instructions.trim() },
        imageUrl: form.imageUrl || "", imagePath: form.imagePath || "", source: organ?.source || null, updatedAt: serverTimestamp(), ...(organ?.createdAt ? {} : { createdAt: serverTimestamp() })
      };
      const batch = writeBatch(db);
      batch.set(publicRef, data, { merge: true });
      batch.set(privateRef, { ownerId: user.uid, internalAccessNotes: form.internalAccessNotes.trim(), updatedAt: serverTimestamp() }, { merge: true });
      await batch.commit();
      if (!isCurrent()) return;
      setMessage({ type: "success", text: "Organ saved." });
      await onSaved?.();
    } catch (error) {
      if (isCurrent()) fail(toUserMessage(error, "Unable to save the organ."));
    } finally {
      if (isCurrent()) setWorking(false);
    }
  }

  return <form className="card stack-lg editor" onSubmit={save} aria-label={organ ? `Edit ${organ.name}` : "New organ"}>
    <div className="flex-between"><h2 ref={heading} tabIndex={-1}>{organ ? `Edit ${organ.name}` : "Create a listing"}</h2><button type="button" className="button-ghost" disabled={working} onClick={onCancel}>Close</button></div>
    {message.text && <div className={`message ${message.type}`} role={message.type === "error" ? "alert" : "status"} ref={feedback} tabIndex={-1}>{message.text}</div>}
    {loading ? <p className="dashboard-loading" role="status">Loading this listing…</p> : loadError ? <button className="button-secondary" type="button" onClick={() => setAttempt((current) => current + 1)}>Try again</button> : <>
      <div className="form-grid"><label>Organ name<input value={form.name} onChange={(event) => patch({ name: event.target.value })} required /></label><label>Institution name<input value={form.organizationName} onChange={(event) => patch({ organizationName: event.target.value })} required /></label></div>
      <PlacePicker value={form.location} onChange={(location) => patch({ location })} label="Organ location" />
      <div className="form-grid"><label>Builder<input value={form.builder} onChange={(event) => patch({ builder: event.target.value })} /></label><label>Year<input value={form.year} onChange={(event) => patch({ year: event.target.value })} /></label><label>Manuals<input type="number" min="0" value={form.manuals} onChange={(event) => patch({ manuals: event.target.value })} /></label><label>Stops<input type="number" min="0" value={form.stops} onChange={(event) => patch({ stops: event.target.value })} /></label></div>
      <label>Public description<textarea value={form.description} onChange={(event) => patch({ description: event.target.value })} required /></label>
      <label>Practice access details<textarea value={form.publicAccessNotes} onChange={(event) => patch({ publicAccessNotes: event.target.value })} placeholder="Who may request access, available times, and any practice requirements." /></label>
      <label>Private internal notes<textarea value={form.internalAccessNotes} onChange={(event) => patch({ internalAccessNotes: event.target.value })} placeholder="Door codes, key locations, and private instructions. Stored separately and owner-only." /></label>
      <ImageUpload label="Organ photo" pathPrefix={`organs/${user.uid}/${organ?.id || "new"}`} value={form.imageUrl} storagePath={form.imagePath} onChange={({ url, path }) => patch({ imageUrl: url, imagePath: path })} />
      <PricingFields value={form.pricing} onChange={(pricing) => patch({ pricing })} />
      <div className="form-grid"><label>Listing status<select value={form.status} onChange={(event) => patch({ status: event.target.value })}><option value="draft">Draft</option><option value="active" disabled={account?.verificationStatus !== "verified"}>Published</option></select></label><label className="checkbox-row"><input type="checkbox" checked={Boolean(form.bookingEnabled)} onChange={(event) => patch({ bookingEnabled: event.target.checked })} />Accept practice requests</label></div>
      {account?.verificationStatus !== "verified" && <div className="message warning">You may save drafts, but manual organization verification is required before publishing.</div>}
    </>}
    <div className="form-actions"><button className="button" disabled={working || loading || loadError}>{working ? "Saving…" : "Save organ"}</button><button className="button-secondary" type="button" disabled={working} onClick={onCancel}>Cancel</button></div>
  </form>;
}
