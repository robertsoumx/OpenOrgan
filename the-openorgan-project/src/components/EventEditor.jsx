"use client";

import { useEffect, useRef, useState } from "react";
import { collection, doc, serverTimestamp, setDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase-client";
import { toUserMessage } from "@/lib/user-error";
import PlacePicker from "@/components/PlacePicker";
import ImageUpload from "@/components/ImageUpload";
import { dateInputValue, timeInputValue } from "@/lib/format";
import TimeZoneField from "@/components/TimeZoneField";
import { DEFAULT_TIME_ZONE, getTimeZone, timeZoneLabel, zonedDateTime } from "@/lib/time-zones.mjs";

function empty(profile) {
  return { title: "", type: "Concert", organizationName: profile?.organizationName || profile?.displayName || "", description: "", date: "", startTime: "", endTime: "", location: null, timeZone: DEFAULT_TIME_ZONE, registrationPolicy: "none", status: "draft", imageUrl: "", imagePath: "" };
}

export default function EventEditor({ user, account, profile, eventItem, onSaved, onCancel }) {
  const [form, setForm] = useState(() => empty(profile));
  const [message, setMessage] = useState({ type: "", text: "" });
  const [working, setWorking] = useState(false);
  const mounted = useRef(false), request = useRef(0), heading = useRef(null), feedback = useRef(null);

  useEffect(() => {
    mounted.current = true;
    request.current += 1;
    setWorking(false);
    const timeZone = getTimeZone(eventItem);
    setForm(eventItem ? { ...empty(profile), ...eventItem, timeZone, date: dateInputValue(eventItem.startDateTime, timeZone), startTime: timeInputValue(eventItem.startDateTime, timeZone), endTime: timeInputValue(eventItem.endDateTime, timeZone) } : empty(profile));
    setMessage({ type: "", text: "" });
    heading.current?.focus();
    return () => { mounted.current = false; request.current += 1; };
  }, [eventItem?.id, profile?.organizationName]);
  useEffect(() => { if (message.type === "error") feedback.current?.focus(); }, [message]);

  function patch(changes) { setForm((current) => ({ ...current, ...changes })); }
  function fail(text) { setMessage({ type: "error", text }); }

  async function save(event) {
    event.preventDefault();
    if (working) return;
    if (!form.location?.placeId) return fail("Select the event location from Google Maps.");
    if (form.status === "active" && account?.verificationStatus !== "verified") return fail("Manual organization verification is required before publishing.");
    let start, end;
    try { start = zonedDateTime(form.date, form.startTime, form.timeZone); end = form.endTime ? zonedDateTime(form.date, form.endTime, form.timeZone) : new Date(start.getTime() + 3600000); }
    catch (error) { return fail(error.message); }
    if (end <= start) return fail("Choose an end time after the start.");
    const version = request.current;
    const isCurrent = () => mounted.current && version === request.current;
    setWorking(true);
    setMessage({ type: "", text: "" });
    try {
      const id = eventItem?.id || doc(collection(db, "events")).id;
      await setDoc(doc(db, "events", id), {
        ownerId: user.uid, title: form.title.trim(), type: form.type.trim(), organizationName: form.organizationName.trim(), description: form.description.trim(), startDateTime: Timestamp.fromDate(start), endDateTime: Timestamp.fromDate(end), location: form.location, timeZone: form.timeZone, registrationPolicy: form.registrationPolicy,
        status: form.status === "active" && account.verificationStatus === "verified" ? "active" : "draft", verificationStatus: account.verificationStatus === "verified" ? "verified" : "unverified", imageUrl: form.imageUrl || "", imagePath: form.imagePath || "", updatedAt: serverTimestamp(), ...(eventItem?.createdAt ? {} : { createdAt: serverTimestamp() })
      }, { merge: true });
      if (!isCurrent()) return;
      setMessage({ type: "success", text: "Event saved." });
      await onSaved?.();
    } catch (error) {
      if (isCurrent()) fail(toUserMessage(error, "Unable to save the event."));
    } finally {
      if (isCurrent()) setWorking(false);
    }
  }

  return <form className="card stack-lg editor" onSubmit={save} aria-label={eventItem ? `Edit ${eventItem.title}` : "New event"}>
    <div className="flex-between"><h2 ref={heading} tabIndex={-1}>{eventItem ? `Edit ${eventItem.title}` : "Publish an event"}</h2><button className="button-ghost" type="button" disabled={working} onClick={onCancel}>Close</button></div>
    {message.text && <div className={`message ${message.type}`} role={message.type === "error" ? "alert" : "status"} ref={feedback} tabIndex={-1}>{message.text}</div>}
    <div className="form-grid"><label>Title<input value={form.title} onChange={(event) => patch({ title: event.target.value })} required /></label><label>Type<input value={form.type} onChange={(event) => patch({ type: event.target.value })} required /></label></div>
    <label>Institution name<input value={form.organizationName} onChange={(event) => patch({ organizationName: event.target.value })} required /></label>
    <label>Description<textarea value={form.description} onChange={(event) => patch({ description: event.target.value })} required /></label>
    <PlacePicker value={form.location} onChange={(location) => patch({ location })} label="Event location" />
    <TimeZoneField value={form.timeZone} onChange={timeZone => patch({ timeZone })}/>
    <p className="time-zone-note">Event times: <strong>{timeZoneLabel(form.timeZone)}</strong></p>
    <div className="form-grid"><label>Date<input type="date" value={form.date} onChange={(event) => patch({ date: event.target.value })} required /></label><label>Start<input type="time" value={form.startTime} onChange={(event) => patch({ startTime: event.target.value })} required /></label><label>End<input type="time" value={form.endTime} onChange={(event) => patch({ endTime: event.target.value })} /></label></div>
    <label>Signup policy<select value={form.registrationPolicy} onChange={(event) => patch({ registrationPolicy: event.target.value })}><option value="none">No signup</option><option value="optional">Optional signup</option><option value="required">Signup required</option></select></label>
    <ImageUpload label="Event image" pathPrefix={`events/${user.uid}/${eventItem?.id || "new"}`} value={form.imageUrl} storagePath={form.imagePath} onChange={({ url, path }) => patch({ imageUrl: url, imagePath: path })} />
    <label>Status<select value={form.status} onChange={(event) => patch({ status: event.target.value })}><option value="draft">Draft</option><option value="active" disabled={account?.verificationStatus !== "verified"}>Published</option></select></label>
    {account?.verificationStatus !== "verified" && <div className="message warning">Your organization may save drafts but cannot publish before manual approval.</div>}
    <div className="form-actions"><button className="button" disabled={working}>{working ? "Saving…" : "Save event"}</button><button type="button" className="button-secondary" disabled={working} onClick={onCancel}>Cancel</button></div>
  </form>;
}
