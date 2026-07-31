const CODE_MESSAGES = {
  "auth/email-already-in-use": "An account already exists for this email. Sign in instead or use another address.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/invalid-credential": "The email or password is incorrect.",
  "auth/user-disabled": "This account is currently unavailable. Contact The OpenOrgan Project for help.",
  "auth/user-not-found": "The email or password is incorrect.",
  "auth/wrong-password": "The email or password is incorrect.",
  "auth/weak-password": "Choose a stronger password with at least eight characters.",
  "auth/too-many-requests": "Too many attempts were made. Wait a moment and try again.",
  "auth/network-request-failed": "The network connection was interrupted. Check your connection and try again.",
  "permission-denied": "You do not have permission to make this change.",
  "firestore/permission-denied": "You do not have permission to make this change.",
  "storage/unauthorized": "You do not have permission to upload this file.",
  "storage/canceled": "The upload was cancelled.",
  "storage/quota-exceeded": "Uploads are temporarily unavailable. Try again later.",
  "unavailable": "The service is temporarily unavailable. Try again in a moment.",
  "firestore/unavailable": "The service is temporarily unavailable. Try again in a moment.",
  "deadline-exceeded": "The request took too long. Check your connection and try again.",
  "resource-exhausted": "The service is busy right now. Try again shortly.",
  "failed-precondition": "This action cannot be completed in its current state.",
  "not-found": "The requested item could not be found.",
  "already-exists": "This item already exists.",
  "cancelled": "The action was cancelled.",
  "network-error": "The network connection was interrupted. Check your connection and try again."
};

const STATUS_MESSAGES = {
  400: "Check the information you entered and try again.",
  401: "Your sign-in has expired. Sign in again and retry.",
  403: "You do not have permission to complete this action.",
  404: "The requested item could not be found.",
  409: "This item was changed elsewhere. Refresh the page and try again.",
  429: "Too many attempts were made. Wait a moment and try again.",
  500: "Something went wrong on our side. Try again shortly.",
  502: "The service is temporarily unavailable. Try again shortly.",
  503: "The service is temporarily unavailable. Try again shortly.",
  504: "The request took too long. Try again shortly."
};

export class UserFacingError extends Error {
  constructor(message, code = "openorgan/user-facing") {
    super(message);
    this.name = "UserFacingError";
    this.code = code;
    this.userFacing = true;
  }
}

export function userError(message, code) {
  return new UserFacingError(message, code);
}

function normalizedCode(error) {
  const raw = String(error?.code || "").trim();
  if (!raw) return "";
  return raw.startsWith("firebase/") ? raw.slice("firebase/".length) : raw;
}

export function messageForStatus(status, fallback = "We could not complete that action. Try again.") {
  return STATUS_MESSAGES[Number(status)] || fallback;
}

export function toUserMessage(error, fallback = "We could not complete that action. Try again.") {
  if (!error) return fallback;
  if (error instanceof UserFacingError || error?.userFacing === true) {
    return String(error.message || fallback);
  }

  const code = normalizedCode(error);
  if (CODE_MESSAGES[code]) return CODE_MESSAGES[code];

  if (error?.name === "AbortError") {
    return "The request was cancelled before it finished.";
  }

  const status = Number(error?.status || error?.statusCode || 0);
  if (status) return messageForStatus(status, fallback);

  const text = String(error?.message || "").toLowerCase();
  if (text.includes("network") || text.includes("failed to fetch") || text.includes("offline")) {
    return CODE_MESSAGES["network-error"];
  }
  if (text.includes("permission") || text.includes("insufficient permissions")) {
    return CODE_MESSAGES["permission-denied"];
  }

  return fallback;
}

export function apiMessage(payload, status, fallback = "We could not complete that request. Try again.") {
  if (payload?.userFacing === true && typeof payload.message === "string" && payload.message.trim()) {
    return payload.message.trim();
  }
  return messageForStatus(status, fallback);
}
