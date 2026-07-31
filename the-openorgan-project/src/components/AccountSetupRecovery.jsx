"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { completeAccountSetup, readPendingSetup } from "@/lib/account-setup";
import { toUserMessage } from "@/lib/user-error";
import { useAuth } from "@/components/AuthProvider";

function destination(role) {
  return role === "organization" ? "/organization" : "/dashboard";
}

export default function AccountSetupRecovery() {
  const router = useRouter();
  const { user, account, profile, refresh } = useAuth();
  const pending = useMemo(() => readPendingSetup(user?.email), [user?.email]);
  const fixedRole = account?.role || profile?.profileType || "";
  const [role, setRole] = useState(fixedRole || pending?.role || "organist");
  const [displayName, setDisplayName] = useState(
    profile?.displayName || user?.displayName || pending?.displayName || ""
  );
  const [organizationName, setOrganizationName] = useState(
    profile?.organizationName || pending?.organizationName || ""
  );
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event) {
    event.preventDefault();
    setWorking(true);
    setMessage("");

    try {
      const result = await completeAccountSetup({
        user,
        role: fixedRole || role,
        displayName,
        organizationName
      });
      await refresh();
      router.replace(destination(result.account?.role || fixedRole || role));
      router.refresh();
    } catch (error) {
      setMessage(toUserMessage(error, "We could not finish account setup. Try again."));
    } finally {
      setWorking(false);
    }
  }

  const effectiveRole = fixedRole || role;

  return (
    <section className="section">
      <div className="container narrow">
        <form className="auth-card setup-recovery" onSubmit={submit}>
          <span className="eyebrow">One final step</span>
          <h1>Finish account setup</h1>
          <p>
            Your sign-in is ready. Confirm the account details below to create the missing profile records.
          </p>

          {!fixedRole && (
            <label>
              Account type
              <select value={role} onChange={(event) => setRole(event.target.value)}>
                <option value="organist">Organist</option>
                <option value="organization">Church, school, or organization</option>
              </select>
            </label>
          )}

          {effectiveRole === "organization" ? (
            <label>
              Organization name
              <input
                value={organizationName}
                onChange={(event) => setOrganizationName(event.target.value)}
                required
              />
            </label>
          ) : (
            <label>
              Your name
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                required
              />
            </label>
          )}

          <button className="button" disabled={working}>
            {working ? "Finishing Setup..." : "Finish Setup"}
          </button>

          {message && <div className="message error" role="alert">{message}</div>}
        </form>
      </div>
    </section>
  );
}
