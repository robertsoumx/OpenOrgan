import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

let cached = null;
let attempted = false;

function parseServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.", error);
    return null;
  }
}

export function getAdminServices() {
  if (cached) return cached;
  if (attempted) return null;
  attempted = true;

  try {
    const serviceAccount = parseServiceAccount();
    const existing = getApps()[0];
    const projectId = serviceAccount?.project_id || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

    if (!existing && !projectId && !process.env.GOOGLE_CLOUD_PROJECT) return null;
    const app = existing || initializeApp({
      credential: serviceAccount ? cert(serviceAccount) : applicationDefault(),
      ...(projectId ? { projectId } : {})
    });

    cached = {
      app,
      auth: getAuth(app),
      db: getFirestore(app)
    };
    return cached;
  } catch (error) {
    console.warn("Firebase Admin is unavailable:", error?.message || error);
    return null;
  }
}

export function requireAdminServices() {
  const services = getAdminServices();
  if (!services) {
    const error = new Error(
      "Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON locally or use an App Hosting runtime with Firebase credentials."
    );
    error.status = 503;
    throw error;
  }
  return services;
}
