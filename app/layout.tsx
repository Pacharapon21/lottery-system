import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lucky Draw | ระบบจับสลากรางวัล",
  description: "ระบบจับสลากรางวัล โปร่งใส ตรวจสอบผลได้ทุกหมายเลข",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
