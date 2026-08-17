"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase-client";
import { readAccountBundle } from "@/lib/account-setup";
import { authenticatedFetch } from "@/lib/api-client";
import { toUserMessage } from "@/lib/user-error";

const Context = createContext({
  user: null,
  account: null,
  profile: null,
  isAdmin: false,
  loading: true,
  setupRequired: false,
  accountError: "",
  refresh: async () => {}
});

async function readAdminCapability() {
  try {
    const result = await authenticatedFetch("/api/admin/me");
    return Boolean(result?.isAdmin);
  } catch {
    // Admin capability is optional. A failure here must never break an
    // otherwise valid normal account session.
    return false;
  }
}

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [account, setAccount] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [accountError, setAccountError] = useState("");

  async function load(uid) {
    if (!uid) {
      setAccount(null);
      setProfile(null);
      setIsAdmin(false);
      setSetupRequired(false);
      setAccountError("");
      return { account: null, profile: null, isAdmin: false };
    }

    try {
      const [bundle, adminCapability] = await Promise.all([
        readAccountBundle(uid),
        readAdminCapability()
      ]);

      setAccount(bundle.account);
      setProfile(bundle.profile);
      setIsAdmin(adminCapability);
      setSetupRequired(!bundle.account || !bundle.profile);
      setAccountError("");

      return {
        ...bundle,
        isAdmin: adminCapability
      };
    } catch (error) {
      setAccount(null);
      setProfile(null);
      setIsAdmin(false);
      setSetupRequired(false);
      setAccountError(
        toUserMessage(error, "We could not load your account. Try again.")
      );

      return { account: null, profile: null, isAdmin: false };
    }
  }

  useEffect(() => {
    if (!auth) {
      setAccountError("Account services are temporarily unavailable.");
      setLoading(false);
      return undefined;
    }

    return onAuthStateChanged(auth, async (current) => {
      setLoading(true);
      setUser(current);
      await load(current?.uid);
      setLoading(false);
    });
  }, []);

  const value = useMemo(
    () => ({
      user,
      account,
      profile,
      isAdmin,
      loading,
      setupRequired,
      accountError,
      refresh: () => load(user?.uid)
    }),
    [
      user,
      account,
      profile,
      isAdmin,
      loading,
      setupRequired,
      accountError
    ]
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAuth() {
  return useContext(Context);
}
