"use client";

import { useState } from "react";
import { addDoc, collection, serverTimestamp, Timestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase-client";
import { useAuth } from "@/components/AuthProvider";
import { toUserMessage } from "@/lib/user-error";
import { dateInputValue, formatDateTime } from "@/lib/format";
import { getTimeZone, timeZoneLabel, zonedDateTime } from "@/lib/time-zones.mjs";

export default function ReservationForm({ organ }) {
  const router = useRouter(), { user, account, profile } = useAuth();
  const [form, setForm] = useState({ date: "", startTime: "", endTime: "", purpose: "" });
  const [message, setMessage] = useState(""), [working, setWorking] = useState(false);
  const timeZone = getTimeZone(organ);
  function change(event) { setForm(current => ({ ...current, [event.target.name]: event.target.value })); }
  async function submit(event) {
    event.preventDefault();
    if (working) return;
    if (!user) return router.push(`/login?next=/organs/${organ.id}`);
    if (account?.role !== "organist") return setMessage("Practice requests require an organist account.");
    if (!organ.bookingEnabled || organ.listingOwnership !== "claimed") return setMessage("This organ is not accepting practice requests.");
    let start, end;
    try { start = zonedDateTime(form.date, form.startTime, timeZone); end = zonedDateTime(form.date, form.endTime, timeZone); }
    catch (error) { return setMessage(error.message); }
    if (start <= new Date() || end <= start) return setMessage("Choose a future session with an end time after its start.");
    setWorking(true); setMessage("");
    try {
      await addDoc(collection(db, "reservations"), {
        userId: user.uid, userName: profile?.displayName || user.displayName || "OpenOrgan user",
        organId: organ.id, organName: organ.name, organizationOwnerId: organ.ownerId, organizationName: organ.organizationName,
        date: form.date, startTime: form.startTime, endTime: form.endTime, timeZone,
        startDateTime: Timestamp.fromDate(start), endDateTime: Timestamp.fromDate(end), purpose: form.purpose.trim(), status: "pending", decisionNote: "",
        pricingSnapshot: organ.pricing || { model: "free", amountCents: 0, currency: "USD", paymentMethods: [], paymentTiming: "", instructions: "" },
        createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      });
      router.push("/dashboard");
    } catch (error) { setMessage(toUserMessage(error, "Unable to submit the request.")); }
    finally { setWorking(false); }
  }
  let preview = "";
  try { if (form.date && form.startTime && form.endTime) preview = formatDateTime(zonedDateTime(form.date, form.startTime, timeZone), timeZone) + " – " + formatDateTime(zonedDateTime(form.date, form.endTime, timeZone), timeZone); } catch {}
  return <form className="card stack" onSubmit={submit}>
    <h2>Request practice time</h2><p>Requests need host approval; arrange any payment directly with the institution.</p>
    <p className="time-zone-note">Venue time: <strong>{timeZoneLabel(timeZone)}</strong></p>
    <div className="form-grid"><label>Date<input name="date" type="date" min={dateInputValue(new Date(), timeZone)} value={form.date} onChange={change} required/></label><label>Start<input name="startTime" type="time" value={form.startTime} onChange={change} required/></label></div>
    <label>End<input name="endTime" type="time" value={form.endTime} onChange={change} required/></label>
    {preview && <p className="small">{preview}</p>}
    <label>What will you practice?<textarea name="purpose" value={form.purpose} onChange={change} required/></label>
    <button className="button" disabled={working}>{working ? "Sending..." : "Send request"}</button>
    {message && <div className="message error" role="alert">{message}</div>}
  </form>;
}
