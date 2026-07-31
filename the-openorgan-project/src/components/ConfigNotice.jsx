"use client";

import { firebaseConfigured } from "@/lib/config";

export default function ConfigNotice() {
  return firebaseConfigured ? null : (
    <div className="config-notice" role="alert">
      Some OpenOrgan account features are temporarily unavailable.
    </div>
  );
}
