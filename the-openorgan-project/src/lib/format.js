import { DEFAULT_TIME_ZONE, zonedParts } from "./time-zones.mjs";

export const PAYMENT_METHODS = [
  ["cash", "Cash"], ["check", "Check"], ["card", "Card"], ["venmo", "Venmo"],
  ["paypal", "PayPal"], ["online", "Online payment link"], ["other", "Other"]
];

export function normalizePricing(value = {}) {
  return {
    model: value.model || "free",
    amountCents: Number(value.amountCents || 0),
    currency: value.currency || "USD",
    paymentTiming: value.paymentTiming || "",
    paymentMethods: Array.isArray(value.paymentMethods) ? value.paymentMethods : [],
    instructions: value.instructions || ""
  };
}

export function formatMoney(cents = 0, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(cents || 0) / 100);
}

export function formatPricing(value) {
  const pricing = normalizePricing(value);
  if (pricing.model === "free") return "Free";
  const amount = formatMoney(pricing.amountCents, pricing.currency);
  return pricing.model === "recommended_donation" ? `Recommended donation: ${amount}` : `Required fee: ${amount}`;
}

export function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
  return null;
}

export function formatDateTime(value, timeZone = DEFAULT_TIME_ZONE) {
  const date = toDate(value);
  return date ? new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(date) : "";
}

export function dateInputValue(value, timeZone = DEFAULT_TIME_ZONE) {
  const date = toDate(value);
  if (!date) return "";
  const parts = zonedParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function timeInputValue(value, timeZone = DEFAULT_TIME_ZONE) {
  const date = toDate(value);
  if (!date) return "";
  const parts = zonedParts(date, timeZone);
  return `${parts.hour}:${parts.minute}`;
}

export function ratingSummary(reviews = []) {
  const ratings = reviews.map((review) => Number(review.rating)).filter(Number.isFinite);
  return ratings.length ? { average: ratings.reduce((sum, value) => sum + value, 0) / ratings.length, count: ratings.length } : { average: 0, count: 0 };
}
