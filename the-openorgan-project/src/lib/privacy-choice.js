const CHOICE_KEY = "openorgan:analytics";

export function analyticsAllowed() {
  if (typeof window === "undefined") return false;
  if (window.navigator?.globalPrivacyControl === true || window.navigator?.doNotTrack === "1") return false;
  try { return window.localStorage.getItem(CHOICE_KEY) === "on"; } catch { return false; }
}

export function setAnalyticsChoice(enabled) {
  window.localStorage.setItem(CHOICE_KEY, enabled ? "on" : "off");
  if (!enabled) { window.localStorage.removeItem("openorgan_visitor_id"); window.localStorage.removeItem("openorgan_session"); }
}
