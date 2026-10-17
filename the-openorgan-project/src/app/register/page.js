import RegisterClient from "@/components/RegisterClient";
export const metadata = {
  title: "Create an account",
  description: "Request practice access, sign up for events, or offer access and publish events on OpenOrgan.",
  robots: { index: false, follow: true }
};
export default async function RegisterPage({ searchParams }) {
  const params = await searchParams;
  const initialRole = params?.role === "organization" ? "organization" : "organist";
  return <section className="auth-page"><RegisterClient initialRole={initialRole} /></section>;
}
