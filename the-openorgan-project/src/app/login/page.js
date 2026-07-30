import { Suspense } from "react";
import LoginClient from "@/components/LoginClient";
export const metadata = { title: "Sign In", robots: { index: false, follow: false } };
export default function LoginPage() { return <section className="auth-page"><Suspense fallback={<div className="skeleton" style={{width:"min(520px,100%)"}} />}><LoginClient /></Suspense></section>; }
