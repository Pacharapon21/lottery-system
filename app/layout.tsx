import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prize Check | เว็บตรวจสอบรางวัล",
  description: "ตรวจสอบผลรางวัลจากหมายเลขสลาก 5 หลัก พร้อมรายชื่อผู้โชคดีและประวัติการประกาศผล",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
