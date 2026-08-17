"use client";

import { useEffect, useState } from "react";
import AuthGate from "@/components/AuthGate";
import { useAuth } from "@/components/AuthProvider";
import { authenticatedFetch } from "@/lib/api-client";
import { toUserMessage } from "@/lib/user-error";

function Step({ number, title, state }) {
  return (
    <div className={`verification-step ${state || ""}`.trim()}>
      <span className="verification-step-number">{number}</span>
      <span className="verification-step-copy">{title}</span>
    </div>
  );
}

function Verification() {
  const { account, refresh } = useAuth();
  const [website, setWebsite] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [message, setMessage] = useState({ type: "", text: "" });
  const [working, setWorking] = useState(false);
  const [editingAddress, setEditingAddress] = useState(false);

  useEffect(() => {
    if (!account) return;
    setWebsite((current) => current || account.verificationWebsite || "");
    setEmail((current) => current || account.verificationEmail || "");
  }, [account]);

  const status = account?.verificationStatus || "unverified";
  const codeStage = status === "code_sent" && !editingAddress;
  const pendingStage = status === "pending_manual";
  const verified = status === "verified";

  async function requestCode(event) {
    event.preventDefault();
    setWorking(true);
    setMessage({ type: "", text: "" });
    try {
      const data = await authenticatedFetch("/api/verification/request", {
        method: "POST",
        body: JSON.stringify({ website, email })
      });
      setSentTo(data.sentTo || email);
      setEditingAddress(false);
      setCode("");
      setMessage({ type: "success", text: `${data.message} It expires in ${data.expiresInMinutes || 10} minutes.` });
      await refresh();
    } catch (error) {
      setMessage({ type: "error", text: toUserMessage(error, "We could not send the code. Try again.") });
    } finally {
      setWorking(false);
    }
  }

  async function confirm(event) {
    event.preventDefault();
    setWorking(true);
    setMessage({ type: "", text: "" });
    try {
      const data = await authenticatedFetch("/api/verification/confirm", {
        method: "POST",
        body: JSON.stringify({ code })
      });
      setMessage({ type: "success", text: data.message });
      await refresh();
    } catch (error) {
      setMessage({ type: "error", text: toUserMessage(error, "We could not confirm that code.") });
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="section verification-page">
      <div className="container verification-shell">
        <header className="verification-intro">
          <span className="eyebrow">Organization verification</span>
          <h1>Confirm your organization.</h1>
          <p>Enter the organization website and a contact email. We send a six-digit code, then the account waits for manual approval.</p>
        </header>

        <div className="verification-progress" aria-label="Verification progress">
          <Step number="1" title="Contact" state={status !== "unverified" ? "complete" : "active"} />
          <Step number="2" title="Enter code" state={pendingStage || verified ? "complete" : codeStage ? "active" : ""} />
          <Step number="3" title="Manual review" state={verified ? "complete" : pendingStage ? "active" : ""} />
        </div>

        {verified ? (
          <div className="verification-result success">
            <span className="verification-result-icon">✓</span>
            <div>
              <h2>Verified</h2>
              <p>Your organization can publish organs and events.</p>
            </div>
          </div>
        ) : pendingStage ? (
          <div className="verification-result">
            <span className="verification-result-icon">•••</span>
            <div>
              <h2>Email confirmed</h2>
              <p>Your organization is waiting for manual review by The OpenOrgan Project.</p>
              {account?.verificationEmail && <span className="verification-meta">Confirmed: {account.verificationEmail}</span>}
            </div>
          </div>
        ) : codeStage ? (
          <div className="verification-card verification-code-card">
            <div className="verification-card-heading">
              <div>
                <span className="eyebrow">Check your inbox</span>
                <h2>Enter the six-digit code</h2>
                <p>Sent to {sentTo || account?.verificationEmail || "your contact email"}.</p>
              </div>
              <button type="button" className="button-ghost" onClick={() => setEditingAddress(true)}>
                Change email
              </button>
            </div>

            <form className="verification-code-form" onSubmit={confirm}>
              <input
                className="verification-code-input"
                inputMode="numeric"
                autoComplete="one-time-code"
                aria-label="Six-digit verification code"
                placeholder="000000"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                required
              />
              <button className="button" disabled={working || code.length !== 6}>
                {working ? "Checking…" : "Confirm code"}
              </button>
            </form>

            <button type="button" className="button-ghost verification-resend" onClick={(event) => requestCode(event)} disabled={working}>
              Send a new code
            </button>
          </div>
        ) : (
          <form className="verification-card verification-address-card" onSubmit={requestCode}>
            <div className="verification-card-heading">
              <div>
                <span className="eyebrow">Step 1</span>
                <h2>Where should we send the code?</h2>
              </div>
            </div>

            <div className="form-grid">
              <label>
                Official website
                <input
                  type="url"
                  value={website}
                  onChange={(event) => setWebsite(event.target.value)}
                  placeholder="https://church.org"
                  required
                />
              </label>
              <label>
                Contact email
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                  required
                />
              </label>
            </div>

            <div className="verification-actions">
              <button className="button" disabled={working}>
                {working ? "Sending…" : "Send six-digit code"}
              </button>
            </div>
          </form>
        )}

        {message.text && (
          <div className={`message ${message.type}`} role={message.type === "error" ? "alert" : "status"}>
            {message.text}
          </div>
        )}
      </div>
    </section>
  );
}

export default function VerificationClient() {
  return <AuthGate role="organization"><Verification /></AuthGate>;
}
