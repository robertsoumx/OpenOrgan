import { auth } from "@/lib/firebase-client";
import { apiMessage, userError } from "@/lib/user-error";

export async function authenticatedFetch(url, options = {}) {
  if (!auth?.currentUser) {
    throw userError("Sign in again to continue.", "openorgan/sign-in-required");
  }

  const token = await auth.currentUser.getIdToken();
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw userError(
      apiMessage(data, response.status),
      `openorgan/http-${response.status}`
    );
  }
  return data;
}
