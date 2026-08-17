import { auth } from "@/lib/firebase-client";
import { apiMessage, userError } from "@/lib/user-error";

async function currentUserReady() {
  if (!auth) {
    throw userError(
      "Account services are temporarily unavailable.",
      "openorgan/auth-unavailable"
    );
  }

  // Firebase restores persisted authentication asynchronously after a reload.
  // Waiting here prevents authenticated API calls from falsely treating that
  // short restoration window as a signed-out session.
  if (typeof auth.authStateReady === "function") {
    await auth.authStateReady();
  }

  if (!auth.currentUser) {
    throw userError("Sign in to continue.", "openorgan/sign-in-required");
  }

  return auth.currentUser;
}

export async function authenticatedFetch(url, options = {}) {
  const user = await currentUserReady();
  const token = await user.getIdToken();

  const response = await fetch(url, {
    ...options,
    cache: "no-store",
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
