"use client";

import { useEffect, useState } from "react";
import { analyticsAllowed, setAnalyticsChoice } from "@/lib/privacy-choice";

export default function PrivacyChoices() {
  const [enabled, setEnabled] = useState(false), [message, setMessage] = useState("");
  useEffect(() => { setEnabled(analyticsAllowed()); }, []);
  function choose(value) {
    try {
      setAnalyticsChoice(value); const actual = analyticsAllowed(); setEnabled(actual);
      setMessage(value && !actual ? "Your browser's privacy signal keeps optional analytics off." : actual ? "Optional analytics are on for this browser." : "Optional analytics are off and their browser identifiers have been cleared.");
    } catch { setMessage("Your browser could not save this choice; optional analytics remain off unless a saved permission exists."); }
  }
  return <div className="privacy-choice"><p>Optional usage analytics: <strong>{enabled ? "On" : "Off"}</strong></p><div className="form-actions"><button type="button" className="button-secondary" aria-pressed={enabled} onClick={() => choose(true)}>Allow usage analytics</button><button type="button" className="button-secondary" aria-pressed={!enabled} onClick={() => choose(false)}>Turn off analytics</button></div><p role="status">{message}</p></div>;
}
