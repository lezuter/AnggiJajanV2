import type { Metadata } from "next";
import localFont from "next/font/local"; // 1. Import ini
import "./globals.css";

// 2. Config Font Minecraft
const minecraft = localFont({
  src: "./fonts/Minecraftia-Regular.ttf", // Pastikan path-nya bener
  variable: "--font-minecraft", // Nama variabel CSS
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "AnggiJajan Admin",
  description: "Top Up Game Termurah",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/* 3. Masukin variabel font ke body */}
      <body className={`${minecraft.variable} antialiased bg-black text-white`}>
        {children}
      </body>
    </html>
  );
}