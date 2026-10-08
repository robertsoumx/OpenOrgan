function normalizeSiteUrl(value) {
  try {
    const url = new URL(String(value || "https://openorgan.org"));
    if (!["http:", "https:"].includes(url.protocol)) return "https://openorgan.org";
    if (process.env.NODE_ENV === "production" && (url.protocol !== "https:" || /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/.test(url.hostname))) return "https://openorgan.org";
    return url.origin;
  } catch {
    return "https://openorgan.org";
  }
}

export const siteUrl = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);

export const firebasePublicConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || ""
};

export const firebaseConfigured = Object.values(firebasePublicConfig).every(Boolean);
export const googleMapsConfigured = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);
