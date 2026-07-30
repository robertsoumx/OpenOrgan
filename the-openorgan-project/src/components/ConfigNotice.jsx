"use client";
import { firebaseConfigured } from "@/lib/config";
export default function ConfigNotice() { return firebaseConfigured ? null : <div className="config-notice">Firebase is not configured. Copy <code>.env.example</code> to <code>.env.local</code> and add the Firebase web-app values.</div>; }
