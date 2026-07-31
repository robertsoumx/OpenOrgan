"use client";

import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/firebase-client";
import {
  completeAccountSetup,
  readAccountBundle,
  rememberPendingSetup
} from "@/lib/account-setup";
import { toUserMessage } from "@/lib/user-error";

export default function RegisterClient() {
  const router = useRouter();
  const [form, setForm] = useState({
    role: "organist",
    displayName: "",
    organizationName: "",
    email: "",
    password: ""
  });
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  function change(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submit(event) {
    event.preventDefault();
    setWorking(true);
    setMessage("");

    const pending = {
      role: form.role,
      displayName: form.displayName.trim(),
      organizationName: form.organizationName.trim(),
      email: form.email.trim().toLowerCase()
    };
    rememberPendingSetup(pending);

    let createdUser = null;

    try {
      if (!auth) throw new Error("service-unavailable");
      const credential = await createUserWithEmailAndPassword(
        auth,
        pending.email,
        form.password
      );
      createdUser = credential.user;

      await completeAccountSetup({ user: createdUser, ...pending });

      const destination = form.role === "organization" ? "/organization" : "/dashboard";
      router.replace(destination);
      router.refresh();
    } catch (error) {
      if (createdUser) {
        try {
          const bundle = await readAccountBundle(createdUser.uid);
          if (bundle.account && bundle.profile) {
            router.replace(bundle.account.role === "organization" ? "/organization" : "/dashboard");
            router.refresh();
            return;
          }
        } catch {
          // The setup recovery screen will retry with the same signed-in user.
        }

        router.replace("/profile?setup=1");
        router.refresh();
        return;
      }

      setMessage(toUserMessage(error, "We could not create the account. Try again."));
    } finally {
      setWorking(false);
    }
  }

  return (
    <form className="auth-card" onSubmit={submit}>
      <span className="eyebrow">Join the project</span>
      <h1>Create an account</h1>

      <label>
        Account type
        <select name="role" value={form.role} onChange={change}>
          <option value="organist">Organist</option>
          <option value="organization">Church, school, or organization</option>
        </select>
      </label>

      {form.role === "organization" ? (
        <label>
          Organization name
          <input name="organizationName" value={form.organizationName} onChange={change} required />
        </label>
      ) : (
        <label>
          Your name
          <input name="displayName" value={form.displayName} onChange={change} required />
        </label>
      )}

      <label>
        Email
        <input name="email" type="email" value={form.email} onChange={change} autoComplete="email" required />
      </label>

      <label>
        Password
        <input
          name="password"
          type="password"
          minLength={8}
          value={form.password}
          onChange={change}
          autoComplete="new-password"
          required
        />
      </label>

      <button className="button" disabled={working}>
        {working ? "Creating Account..." : "Create Account"}
      </button>

      {message && <div className="message error" role="alert">{message}</div>}

      <p className="muted">
        Already registered? <Link href="/login">Sign in</Link>.
      </p>
    </form>
  );
}
