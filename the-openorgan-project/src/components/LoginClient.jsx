"use client";
import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase-client";

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  async function submit(event) {
    event.preventDefault(); setWorking(true); setMessage("");
    try {
      if (!auth) throw new Error("Firebase is not configured.");
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      const requested = searchParams.get("next");
      const safeNext = requested?.startsWith("/") && !requested.startsWith("//") ? requested : null;
      let defaultDestination = "/dashboard";
      if (db) {
        const accountSnap = await getDoc(doc(db, "users", result.user.uid));
        if (accountSnap.exists() && accountSnap.data().role === "organization") {
          defaultDestination = "/organization";
        }
      }
      router.replace(safeNext || defaultDestination);
      router.refresh();
    } catch (error) { setMessage(error.message || "Unable to sign in."); }
    finally { setWorking(false); }
  }
  return <form className="auth-card" onSubmit={submit}><span className="eyebrow">Welcome back</span><h1>Sign in</h1><label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></label><label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></label><button className="button" disabled={working}>{working ? "Signing In..." : "Sign In"}</button>{message && <div className="message error">{message}</div>}<p className="muted">New here? <Link href="/register">Create an account</Link>.</p></form>;
}
