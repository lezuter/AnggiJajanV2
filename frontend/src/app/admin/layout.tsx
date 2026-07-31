"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import AdminTemplate from "@/components/AdminTemplate";

const normalizePath = (value: string | null) => {
  if (!value) return "";
  if (value === "/") return value;
  return value.replace(/\/+$/, "");
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    const currentPath = normalizePath(pathname);
    const isLoginPage = currentPath === "/admin/login";
    const token = localStorage.getItem("token");

    setIsAuthorized(false);

    if (isLoginPage && token) {
      router.replace("/admin/dashboard/");
      return;
    }

    if (!isLoginPage && !token) {
      router.replace("/admin/login/");
      return;
    }

    setIsAuthorized(true);
  }, [isMounted, pathname, router]);

  // Loading State
  if (!isAuthorized) {
    return (
      <main className="min-h-screen bg-[#15173d] text-white flex items-center justify-center">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-xs font-bold uppercase tracking-[0.2em] text-slate-300 shadow-2xl">
          Memeriksa sesi admin...
        </div>
      </main>
    );
  }

  // Render Halaman Login Polosan
  if (normalizePath(pathname) === "/admin/login") {
    return <main>{children}</main>;
  }

  // Render Halaman Admin pake Sidebar
  return (
    <>
      {/* 🔥 MESIN 3D ABADI NYALA KHUSUS DI AREA ADMIN 🔥 */}

      <AdminTemplate>{children}</AdminTemplate>
    </>
  );
}
