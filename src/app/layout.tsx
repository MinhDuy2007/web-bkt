import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "web-bkt",
  description: "Nền tảng khởi tạo tối thiểu cho dự án web-bkt.",
};

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
