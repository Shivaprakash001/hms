import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";

import "./globals.css";
import { Providers } from "@/lib/providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Sri Adithya Hostels",
  description: "Modern hostel management platform for Sri Adithya Hostels.",
  alternates: {
    canonical: "https://sriadithyahostels.in/",
  },
  openGraph: {
    title: "Sri Adithya Hostels",
    description: "Modern hostel management platform for Sri Adithya Hostels.",
    url: "https://sriadithyahostels.in/",
    siteName: "Sri Adithya Hostels",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sri Adithya Hostels",
    description: "Modern hostel management platform for Sri Adithya Hostels.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
        <SpeedInsights />
      </body>
    </html>
  );
}
