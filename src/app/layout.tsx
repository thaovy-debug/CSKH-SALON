import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { ThemeInit } from "@/components/theme-init";
import "./globals.css";

export const metadata: Metadata = {
  title: "LinhKienLed1000 - Trợ lý CSKH AI",
  description: "Nền tảng hỗ trợ khách hàng bằng AI cho doanh nghiệp",
  icons: {
    icon: "/led1000-favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="h-full antialiased" suppressHydrationWarning>
      <body className="h-full">
          <Providers>
            <ThemeInit />
            {children}
          </Providers>
        </body>
    </html>
  );
}
