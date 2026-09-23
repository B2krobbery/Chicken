import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-jb",
});

export const metadata: Metadata = {
  title: "TheChickenMan | B2B Commercial Poultry Marketplace",
  description:
    "Institutional poultry procurement: verified suppliers, real-time inventory, GST invoicing, cold-chain POD delivery.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>
      <body className={inter.className}>
        <AuthProvider>
          <div className="min-h-screen bg-slate-50">{children}</div>
        </AuthProvider>
      </body>
    </html>
  );
}
