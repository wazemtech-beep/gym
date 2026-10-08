import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import ReadCacheBridge from "@/components/common/ReadCacheBridge";
import { getCurrentSession } from "@/lib/session";
import { readCacheScope } from "@/lib/serverReadCache";

const barlow = localFont({
  src: [
    { path: "./fonts/Barlow-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/Barlow-Medium.ttf", weight: "500", style: "normal" },
    { path: "./fonts/Barlow-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "./fonts/Barlow-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-barlow",
  display: "swap",
});

const barlowCondensed = localFont({
  src: [
    { path: "./fonts/BarlowCondensed-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "./fonts/BarlowCondensed-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-barlow-condensed",
  display: "swap",
});

export const metadata: Metadata = {
  title: "OXGEN GYM · Gym management",
  description: "Manage your gym's members, memberships and daily collections.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const current = await getCurrentSession();
  return (
    <html lang="en" className={`${barlow.variable} ${barlowCondensed.variable}`}>
      <body><ReadCacheBridge scope={current ? readCacheScope(current) : ""}>{children}</ReadCacheBridge></body>
    </html>
  );
}
