import AdminGate from "@/components/AdminGate";
import AdminClaimsClient from "@/components/AdminClaimsClient";

export const metadata = {
  title: "Admin: Claims",
  robots: { index: false, follow: false }
};

export default function Page() {
  return (
    <AdminGate>
      <AdminClaimsClient />
    </AdminGate>
  );
}
