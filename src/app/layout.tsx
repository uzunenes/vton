import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Antigravity VTON",
  description: "Cloud-Native Virtual Try-On",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-black text-white antialiased overflow-x-hidden selection:bg-purple-500/30`}>
        {children}
      </body>
    </html>
  );
}
