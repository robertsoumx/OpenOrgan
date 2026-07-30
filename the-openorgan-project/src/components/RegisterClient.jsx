"use client";
import { useState } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { auth, db } from "@/lib/firebase-client";

export default function RegisterClient() {
  const [form, setForm] = useState({ role: "organist", displayName: "", organizationName: "", email: "", password: "" });
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  function change(event) { setForm({ ...form, [event.target.name]: event.target.value }); }
  async function submit(event) {
    event.preventDefault(); setWorking(true); setMessage("");
    try {
      if (!auth || !db) throw new Error("Firebase is not configured.");
      const credential = await createUserWithEmailAndPassword(auth, form.email.trim(), form.password);
      const uid = credential.user.uid;
      const name = form.role === "organization" ? form.organizationName.trim() : form.displayName.trim();
      await updateProfile(credential.user, { displayName: name });
      const batch = writeBatch(db);
      batch.set(doc(db, "users", uid), {
        uid, role: form.role, email: form.email.trim().toLowerCase(),
        verificationStatus: form.role === "organization" ? "unverified" : "not_applicable",
        createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      });
      batch.set(doc(db, "profiles", uid), form.role === "organization" ? {
        userId: uid, profileType: "organization", organizationName: form.organizationName.trim(), displayName: form.organizationName.trim(),
        website: "", bio: "", photoURL: "", administratorName: "", administratorBio: "", administratorPhotoURL: "",
        createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      } : {
        userId: uid, profileType: "organist", displayName: form.displayName.trim(), bio: "", photoURL: "",
        experienceLevel: "student", yearsExperience: 0, ageRange: "prefer_not_to_say", city: "", region: "",
        createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      });
      batch.set(doc(db, "publicContacts", uid), { userId: uid, email: form.email.trim().toLowerCase(), visible: false, updatedAt: serverTimestamp() });
      if (form.role === "organist") batch.set(doc(db, "trustProfiles", uid), { userId: uid, completedSessions: 0, updatedAt: serverTimestamp() });
      await batch.commit();
      window.location.assign(form.role === "organization" ? "/organization" : "/dashboard");
    } catch (error) { setMessage(error.message || "Unable to create the account."); }
    finally { setWorking(false); }
  }
  return <form className="auth-card" onSubmit={submit}><span className="eyebrow">Join the project</span><h1>Create an account</h1><label>Account type<select name="role" value={form.role} onChange={change}><option value="organist">Organist</option><option value="organization">Church, school, or organization</option></select></label>{form.role === "organization" ? <label>Organization name<input name="organizationName" value={form.organizationName} onChange={change} required /></label> : <label>Your name<input name="displayName" value={form.displayName} onChange={change} required /></label>}<label>Email<input name="email" type="email" value={form.email} onChange={change} required /></label><label>Password<input name="password" type="password" minLength={8} value={form.password} onChange={change} required /></label><button className="button" disabled={working}>{working ? "Creating Account..." : "Create Account"}</button>{message && <div className="message error">{message}</div>}</form>;
}
