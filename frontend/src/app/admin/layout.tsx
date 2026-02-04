"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import AdminTemplate from "@/components/AdminTemplate"; 

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    // 1. AMBIL TOKEN DULU
    const token = localStorage.getItem("token"); 

    // 2. KASUS: Udah Login (Ada Token) TAPI maksa buka Halaman Login
    if (pathname === "/admin/login" && token) {
      router.push("/admin/dashboard"); // Lempar masuk ke dashboard
      return;
    }

    // 3. KASUS: Belum Login (Ga Ada Token) TAPI maksa buka Dashboard
    if (pathname !== "/admin/login" && !token) {
      router.push("/admin/login"); // Tendang keluar ke login
      return;
    }

    // 4. KASUS AMAN:
    // - Belum login & ada di halaman login (User mau login) -> OK
    // - Udah login & ada di dashboard (User admin) -> OK
    setIsAuthorized(true);

  }, [pathname, router]);

  // Loading State
  if (!isAuthorized) {
    // Trik: Kalau lagi di halaman login & punya token (lagi proses redirect ke dashboard), 
    // jangan tampilin apa-apa biar ga nge-glitch form loginnya.
    return null; 
  }

  // Render Halaman Login Polosan
  if (pathname === "/admin/login") {
    return <main>{children}</main>;
  }

  // Render Halaman Admin pake Sidebar
  return (
    <AdminTemplate>
      {children}
    </AdminTemplate>
  );
}