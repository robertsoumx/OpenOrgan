import { getApps, initializeApp } from "firebase/app";
import { collection, doc, getDoc, getDocs, getFirestore, limit, query, where } from "firebase/firestore/lite";
import { getAdminServices } from "@/lib/firebase-admin";
import { firebaseConfigured, firebasePublicConfig } from "@/lib/config";

export function serialize(value) {
  if (value == null) return value;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialize(item)]));
  return value;
}

function publicDb() {
  if (!firebaseConfigured) return null;
  const name = "openorgan-public-server";
  const existing = getApps().find((item) => item.name === name);
  return getFirestore(existing || initializeApp(firebasePublicConfig, name));
}

export async function getPublicDocument(collectionName, id) {
  if (!id) return null;
  try {
    const admin = getAdminServices();
    if (admin) {
      const snapshot = await admin.db.collection(collectionName).doc(id).get();
      if (!snapshot.exists) return null;
      const data = snapshot.data();
      if (data.status && data.status !== "active") return null;
      return serialize({ id: snapshot.id, ...data });
    }
    const database = publicDb();
    if (!database) return null;
    const snapshot = await getDoc(doc(database, collectionName, id));
    return snapshot.exists() ? serialize({ id: snapshot.id, ...snapshot.data() }) : null;
  } catch (error) {
    console.warn(`Unable to read ${collectionName}/${id}:`, error?.message || error);
    return null;
  }
}

export async function getActivePublicDocuments(collectionName, maximum = 500) {
  try {
    const admin = getAdminServices();
    if (admin) {
      const snapshot = await admin.db.collection(collectionName).where("status", "==", "active").limit(maximum).get();
      return snapshot.docs.map((item) => serialize({ id: item.id, ...item.data() }));
    }
    const database = publicDb();
    if (!database) return [];
    const snapshot = await getDocs(query(collection(database, collectionName), where("status", "==", "active"), limit(maximum)));
    return snapshot.docs.map((item) => serialize({ id: item.id, ...item.data() }));
  } catch (error) {
    console.warn(`Unable to read ${collectionName}:`, error?.message || error);
    return [];
  }
}
