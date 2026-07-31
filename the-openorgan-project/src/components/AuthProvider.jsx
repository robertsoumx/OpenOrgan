"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase-client";
import { readAccountBundle } from "@/lib/account-setup";
import { toUserMessage } from "@/lib/user-error";

const Context = createContext({
  user: null,
  account: null,
  profile: null,
  loading: true,
  setupRequired: false,
  accountError: "",
  refresh: async () => {}
});

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [account, setAccount] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [accountError, setAccountError] = useState("");

  async function load(uid) {
    if (!uid) {
      setAccount(null);
      setProfile(null);
      setSetupRequired(false);
      setAccountError("");
      return { account: null, profile: null };
    }

    try {
      const bundle = await readAccountBundle(uid);
      setAccount(bundle.account);
      setProfile(bundle.profile);
      setSetupRequired(!bundle.account || !bundle.profile);
      setAccountError("");
      return bundle;
    } catch (error) {
      setAccount(null);
      setProfile(null);
      setSetupRequired(false);
      setAccountError(toUserMessage(error, "We could not load your account. Try again."));
      return { account: null, profile: null };
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

  const value = useMemo(() => ({
    user,
    account,
    profile,
    loading,
    setupRequired,
    accountError,
    refresh: () => load(user?.uid)
  }), [user, account, profile, loading, setupRequired, accountError]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAuth() {
  return useContext(Context);
}
