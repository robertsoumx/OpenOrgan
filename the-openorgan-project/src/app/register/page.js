import RegisterClient from "@/components/RegisterClient";
export const metadata = {
  title: "Join",
  description: "Create an organist or organization account with The OpenOrgan Project.",
  robots: { index: false, follow: true }
};
export default function RegisterPage() { return <section className="auth-page"><RegisterClient /></section>; }
