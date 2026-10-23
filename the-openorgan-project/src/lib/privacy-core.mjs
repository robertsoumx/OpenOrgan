export const PRIVACY_REQUEST_TYPES = { access: "Access my data", correction: "Correct my data", deletion: "Delete my account or data", question: "Privacy question" };
export const PRIVACY_REQUEST_STATUSES = { open: "Received", in_progress: "In review", closed: "Closed" };

export function privacyRequestBody(input) {
  const type = input?.type, details = typeof input?.details === "string" ? input.details.trim() : "";
  if (!Object.hasOwn(PRIVACY_REQUEST_TYPES, type) || details.length < 5 || details.length > 2000) throw Object.assign(new Error("Choose a request type and enter 5–2,000 characters."), { status: 400 });
  return { type, details };
}

export function privacyRequestItem(snapshot) {
  const value = snapshot.data();
  const iso = field => value[field]?.toDate?.().toISOString() || (value[field] instanceof Date ? value[field].toISOString() : null);
  return { id: snapshot.id, userId: value.userId, type: value.type, details: value.details, status: value.status, reply: value.reply || "", createdAt: iso("createdAt"), updatedAt: iso("updatedAt") };
}
