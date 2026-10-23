import AdminGate from "@/components/AdminGate";
import PrivacyRequests from "@/components/PrivacyRequests";

export const metadata = { title: "Admin: Privacy requests", robots: { index: false, follow: false } };

export default function Page() {
  return <AdminGate><section className="section"><div className="container narrow"><header className="page-header"><h1>Privacy requests</h1><p>Review data requests and respond privately to the account holder.</p></header><PrivacyRequests admin/></div></section></AdminGate>;
}
