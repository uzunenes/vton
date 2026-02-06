import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap", // Prevent FOIT (Flash of Invisible Text)
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "VTON - Virtual Try-On",
  description:
    "Experience clothing in its natural element. Cinematic runway simulation powered by high-fidelity neural synthesis.",
  keywords: ["virtual try-on", "fashion", "AI", "clothing", "runway"],
  authors: [{ name: "VTON" }],
  creator: "VTON",
  openGraph: {
    title: "VTON - Virtual Try-On",
    description:
      "Experience clothing in its natural element. Cinematic runway simulation powered by high-fidelity neural synthesis.",
    type: "website",
    locale: "en_US",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5, // Allow zooming for accessibility
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body
        className={`${inter.className} bg-black text-white antialiased overflow-x-hidden selection:bg-purple-500/30`}
      >
        {/* Skip Link for Keyboard Navigation */}
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>

        {/* Screen Reader Only - Page Title */}
        <header className="sr-only">
          <h1>VTON - Virtual Try-On Experience</h1>
        </header>

        {/* Main Content */}
        <main id="main-content" role="main">
          {children}
        </main>

        {/* Screen Reader Only - Footer Info */}
        <footer className="sr-only" role="contentinfo">
          <p>VTON Virtual Try-On Application</p>
        </footer>
      </body>
    </html>
  );
}
