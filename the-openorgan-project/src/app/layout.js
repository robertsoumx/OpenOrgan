import "@/app/globals.css";
import Providers from "@/app/providers";
import SiteNavbar from "@/components/SiteNavbar";
import SiteFooter from "@/components/SiteFooter";
import ConfigNotice from "@/components/ConfigNotice";
import { siteUrl } from "@/lib/config";

const googleVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined;
const bingVerification = process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION || undefined;

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "The OpenOrgan Project | Pipe Organ Access & Events",
    template: "%s | The OpenOrgan Project"
  },
  description:
    "Find organs and events, offer free or paid practice access, and publish upcoming events on OpenOrgan.",
  applicationName: "The OpenOrgan Project",
  creator: "The OpenOrgan Project",
  publisher: "The OpenOrgan Project",
  category: "Music",
  keywords: [
    "pipe organ",
    "organ practice",
    "church organ",
    "organist",
    "pipe organs",
    "organ concerts",
    "organ practice"
  ],
  alternates: { canonical: "/" },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg"
  },
  manifest: "/manifest.webmanifest",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1
    }
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "The OpenOrgan Project",
    title: "The OpenOrgan Project | Pipe Organ Access & Events",
    description:
      "Find organs and events, offer free or paid practice access, and publish upcoming events on OpenOrgan.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "The OpenOrgan Project"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "The OpenOrgan Project | Pipe Organ Access & Events",
    description: "Find organs and events, offer free or paid practice access, and publish upcoming events on OpenOrgan.",
    images: ["/opengraph-image"]
  },
  verification: {
    ...(googleVerification ? { google: googleVerification } : {}),
    ...(bingVerification ? { other: { "msvalidate.01": bingVerification } } : {})
  }
};

function StructuredSiteData() {
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: "The OpenOrgan Project",
        url: siteUrl,
        logo: `${siteUrl}/openorgan-logo.svg`,
        description:
          "An open-source platform to find pipe organs and events, offer free or paid practice access, and publish upcoming events."
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: siteUrl,
        name: "The OpenOrgan Project",
        publisher: { "@id": `${siteUrl}/#organization` },
        inLanguage: "en-US"
      }
    ]
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <StructuredSiteData />
        <Providers>
          <SiteNavbar />
          <ConfigNotice />
          <main id="main-content">{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
