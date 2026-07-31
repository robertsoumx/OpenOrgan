"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/firebase-client";
import { readAccountBundle } from "@/lib/account-setup";
import { toUserMessage } from "@/lib/user-error";

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setWorking(true);
    setMessage("");

    try {
      if (!auth) throw new Error("service-unavailable");
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      const requested = searchParams.get("next");
      const safeNext = requested?.startsWith("/") && !requested.startsWith("//") ? requested : null;

      const bundle = await readAccountBundle(result.user.uid);
      if (!bundle.account || !bundle.profile) {
        router.replace("/profile?setup=1");
        router.refresh();
        return;
      }

      const defaultDestination = bundle.account.role === "organization" ? "/organization" : "/dashboard";
      router.replace(safeNext || defaultDestination);
      router.refresh();
    } catch (error) {
      setMessage(toUserMessage(error, "We could not sign you in. Try again."));
    } finally {
      setWorking(false);
    }
  }

  return (
    <form className="auth-card" onSubmit={submit}>
      <span className="eyebrow">Welcome back</span>
      <h1>Sign in</h1>

      <label>
        Email
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
        />
      </label>

      <label>
        Password
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
        />
      </label>

      <button className="button" disabled={working}>
        {working ? "Signing In..." : "Sign In"}
      </button>

      {message && <div className="message error" role="alert">{message}</div>}

      <p className="muted">
        New here? <Link href="/register">Create an account</Link>.
      </p>
    </form>
  );
}
