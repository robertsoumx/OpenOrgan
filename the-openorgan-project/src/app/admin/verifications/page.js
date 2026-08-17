import AdminGate from "@/components/AdminGate";
import AdminVerificationsClient from "@/components/AdminVerificationsClient";

export const metadata = {
  title: "Admin: Verifications",
  robots: { index: false, follow: false }
};

export default function Page() {
  return (
    <AdminGate>
      <AdminVerificationsClient />
    </AdminGate>
  );
}
