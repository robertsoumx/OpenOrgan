import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { firebaseConfigured, firebasePublicConfig } from "@/lib/config";

let app = null;
let auth = null;
let db = null;
let storage = null;

if (firebaseConfigured && typeof window !== "undefined") {
  app = getApps().length ? getApp() : initializeApp(firebasePublicConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
}

export { app, auth, db, storage };
