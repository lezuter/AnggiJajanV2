import type { Metadata } from "next";
import localFont from "next/font/local"; // 1. Import ini
import GlobalCanvas from "@/components/GlobalCanvas";
import "./globals.css";

// 2. Config Font Minecraft
const minecraft = localFont({
  src: "./fonts/Minecraftia-Regular.ttf", // Pastikan path-nya bener
  variable: "--font-minecraft", // Nama variabel CSS
  weight: "100 900",
});

const cendrickNode = localFont({
  src: "./fonts/CendrickNodeDEMO-Extended.ttf",
  variable: "--font-cendrick-node",
  weight: "400",
  style: "normal",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Anggijajan - Top Up Game",
  description: "Top up game cepat, aman, dan otomatis.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      {/* 3. Masukin variabel font ke body */}
      <body
        className={`${minecraft.variable} ${cendrickNode.variable} antialiased bg-black text-white`}
      >
        {children}
        <GlobalCanvas />
      </body>
    </html>
  );
}
