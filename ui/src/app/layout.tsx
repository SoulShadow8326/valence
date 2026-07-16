import type { Metadata } from "next";
import { Geist_Mono, Montserrat } from "next/font/google";
import "./globals.css";
import { PhoneFrame } from "./components/phone-frame";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Valence",
  description: "Coordinate with the people around you, with no towers and no servers.",
};

export const viewport = {
  themeColor: "#f4f4f5",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${montserrat.variable} ${geistMono.variable} h-full`}>
      <body className="h-[100dvh] overflow-hidden">
        <PhoneFrame>{children}</PhoneFrame>
      </body>
    </html>
  );
}
