import RoleAwareHome from "@/components/RoleAwareHome";
import HomeHighlights from "@/components/HomeHighlights";

export const metadata = {
  title: "The OpenOrgan Project | Pipe Organ Access & Events",
  description: "Discover pipe organs, practice access, and organ events through The OpenOrgan Project, beginning in Greater Boston.",
  alternates: { canonical: "/" }
};

export default function HomePage() {
  return (
    <>
      <RoleAwareHome />
      <HomeHighlights />
    </>
  );
}
