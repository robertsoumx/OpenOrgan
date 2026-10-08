import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
const refreshSecret = defineSecret("EVENT_REFRESH_SECRET");
// This job runs even when no one visits the website.
export const refreshOrganCalendars = onSchedule({
  schedule: "0 */6 * * *",
  timeZone: "America/New_York",
  region: "us-east1",
  secrets: [refreshSecret],
  timeoutSeconds: 60,
  maxInstances: 1,
  retryCount: 2
}, async () => {
  const response = await fetch("https://openorgan.org/api/events/refresh", {
    method: "POST",
    headers: { Authorization: "Bearer " + refreshSecret.value() },
    signal: AbortSignal.timeout(45000)
  });
  if (!response.ok) throw new Error("Calendar refresh returned HTTP " + response.status);
});
