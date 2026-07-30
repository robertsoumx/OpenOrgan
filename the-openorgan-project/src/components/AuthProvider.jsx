"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase-client";

const Context = createContext({ user: null, account: null, profile: null, loading: true, refresh: async () => {} });

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [account, setAccount] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load(uid) {
    if (!db || !uid) { setAccount(null); setProfile(null); return; }
    const [accountSnap, profileSnap] = await Promise.all([getDoc(doc(db, "users", uid)), getDoc(doc(db, "profiles", uid))]);
    setAccount(accountSnap.exists() ? accountSnap.data() : null);
    setProfile(profileSnap.exists() ? profileSnap.data() : null);
  }

  useEffect(() => {
    if (!auth) { setLoading(false); return; }
    return onAuthStateChanged(auth, async (current) => {
      setUser(current);
      try { await load(current?.uid); } finally { setLoading(false); }
    });
  }, []);

  const value = useMemo(() => ({ user, account, profile, loading, refresh: () => load(user?.uid) }), [user, account, profile, loading]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAuth() { return useContext(Context); }
