import { auth } from "@/lib/firebase-client";

export async function authenticatedFetch(url, options = {}) {
  if (!auth?.currentUser) throw new Error("Sign in is required.");
  const token = await auth.currentUser.getIdToken();
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}
