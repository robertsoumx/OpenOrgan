import { updateProfile } from "firebase/auth";
import {
  doc,
  getDoc,
  serverTimestamp,
  writeBatch
} from "firebase/firestore";
import { db } from "@/lib/firebase-client";
import { userError } from "@/lib/user-error";

const STORAGE_KEY = "openorgan.pending-account-setup.v1";

function normalizeRole(value) {
  return value === "organization" ? "organization" : "organist";
}

export function rememberPendingSetup(value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...value,
      email: String(value?.email || "").trim().toLowerCase(),
      role: normalizeRole(value?.role),
      savedAt: Date.now()
    }));
  } catch {
    // Account creation still works when browser storage is unavailable.
  }
}

export function readPendingSetup(email = "") {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
    if (!value) return null;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (normalizedEmail && value.email && value.email !== normalizedEmail) return null;
    return value;
  } catch {
    return null;
  }
}

export function clearPendingSetup() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing else is required.
  }
}

export async function readAccountBundle(uid) {
  if (!db || !uid) {
    throw userError("Account services are temporarily unavailable.");
  }

  const [accountSnapshot, profileSnapshot] = await Promise.all([
    getDoc(doc(db, "users", uid)),
    getDoc(doc(db, "profiles", uid))
  ]);

  return {
    account: accountSnapshot.exists() ? accountSnapshot.data() : null,
    profile: profileSnapshot.exists() ? profileSnapshot.data() : null
  };
}

function organistProfile(uid, displayName) {
  return {
    userId: uid,
    profileType: "organist",
    displayName: displayName || "OpenOrgan member",
    bio: "",
    photoURL: "",
    experienceLevel: "student",
    yearsExperience: 0,
    ageRange: "prefer_not_to_say",
    city: "",
    region: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
}

function organizationProfile(uid, organizationName) {
  const name = organizationName || "Organization";
  return {
    userId: uid,
    profileType: "organization",
    organizationName: name,
    displayName: name,
    website: "",
    bio: "",
    photoURL: "",
    administratorName: "",
    administratorBio: "",
    administratorPhotoURL: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
}

export async function completeAccountSetup({
  user,
  role,
  displayName,
  organizationName
}) {
  if (!user?.uid || !db) {
    throw userError("Account services are temporarily unavailable.");
  }

  const current = await readAccountBundle(user.uid);
  const effectiveRole = current.account?.role || current.profile?.profileType || normalizeRole(role);
  const name = effectiveRole === "organization"
    ? String(organizationName || displayName || user.displayName || "").trim()
    : String(displayName || user.displayName || "").trim();

  if (!name) {
    throw userError(effectiveRole === "organization"
      ? "Enter the organization name to finish setup."
      : "Enter your name to finish setup.");
  }

  const [contactSnapshot, trustSnapshot] = await Promise.all([
    getDoc(doc(db, "publicContacts", user.uid)).catch(() => null),
    effectiveRole === "organist"
      ? getDoc(doc(db, "trustProfiles", user.uid)).catch(() => null)
      : Promise.resolve(null)
  ]);

  const batch = writeBatch(db);

  if (!current.account) {
    batch.set(doc(db, "users", user.uid), {
      uid: user.uid,
      role: effectiveRole,
      email: String(user.email || "").trim().toLowerCase(),
      verificationStatus: effectiveRole === "organization" ? "unverified" : "not_applicable",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  if (!current.profile) {
    batch.set(
      doc(db, "profiles", user.uid),
      effectiveRole === "organization"
        ? organizationProfile(user.uid, name)
        : organistProfile(user.uid, name)
    );
  }

  if (!contactSnapshot?.exists?.()) {
    batch.set(doc(db, "publicContacts", user.uid), {
      userId: user.uid,
      email: String(user.email || "").trim().toLowerCase(),
      visible: false,
      updatedAt: serverTimestamp()
    });
  }

  if (effectiveRole === "organist" && !trustSnapshot?.exists?.()) {
    batch.set(doc(db, "trustProfiles", user.uid), {
      userId: user.uid,
      completedSessions: 0,
      updatedAt: serverTimestamp()
    });
  }

  await batch.commit();

  if (user.displayName !== name) {
    await updateProfile(user, { displayName: name }).catch(() => {});
  }

  clearPendingSetup();
  return readAccountBundle(user.uid);
}
