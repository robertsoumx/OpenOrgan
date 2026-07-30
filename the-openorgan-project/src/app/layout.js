import "@/app/globals.css";
import Providers from "@/app/providers";
import SiteNavbar from "@/components/SiteNavbar";
import SiteFooter from "@/components/SiteFooter";
import ConfigNotice from "@/components/ConfigNotice";
import { siteUrl } from "@/lib/config";

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "The OpenOrgan Project", template: "%s | The OpenOrgan Project" },
  description: "Find pipe organ practice access, events, and organizations through The OpenOrgan Project.",
  applicationName: "The OpenOrgan Project",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg", apple: "/favicon.svg" },
  openGraph: { type: "website", siteName: "The OpenOrgan Project", title: "The OpenOrgan Project", description: "Organ access and events, beginning in Greater Boston.", images: ["/openorgan-logo.svg"] },
  twitter: { card: "summary", title: "The OpenOrgan Project", description: "Organ access and events, beginning in Greater Boston.", images: ["/openorgan-logo.svg"] }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <SiteNavbar />
          <ConfigNotice />
          <main>{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
