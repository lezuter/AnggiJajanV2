"use client";

import { useState, useEffect, createContext, useContext } from "react";
import { usePathname, useRouter } from "next/navigation";
import AdminSidebar from "./AdminSidebar";
import NotificationBell from "./NotificationBell";

// 🔥 1. BIKIN CONTEXT BUAT NGE-TRACK STATUS DRAWER
interface DrawerContextType {
  isDrawerOpen: boolean;
  setIsDrawerOpen: (val: boolean) => void;
}

const DrawerContext = createContext<DrawerContextType>({
  isDrawerOpen: false,
  setIsDrawerOpen: () => {},
});

export const useDrawer = () => useContext(DrawerContext);

const normalizePath = (value: string | null) => {
  if (!value) return "";
  if (value === "/") return value;
  return value.replace(/\/+$/, "");
};

export default function AdminTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    const currentPath = normalizePath(pathname);
    const token = localStorage.getItem("token");
    if (!token && currentPath !== "/admin/login") {
      router.replace("/admin/login/");
    } else {
      // Auth gate resolves only after client-side localStorage is available.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsChecking(false);
    }
  }, [router, pathname]);

  if (normalizePath(pathname) === "/admin/login") return <>{children}</>;
  if (isChecking) {
    return (
      <div className="h-screen w-full bg-[#15173d] text-white flex items-center justify-center">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-xs font-bold uppercase tracking-[0.2em] text-slate-300">
          Memuat area admin...
        </div>
      </div>
    );
  }

  return (
    <DrawerContext.Provider value={{ isDrawerOpen, setIsDrawerOpen }}>
      <div className="relative h-screen w-full bg-[#15173d] text-white selection:bg-[#E491C9] selection:text-[#15173d] font-sans">
        {/* ── HIGH-SPEC LIQUID CANVAS ── */}
        <style>{`
          @-webkit-keyframes liquidAurora { 0% { background-position: 0% 50%, 100% 50%, 50% 100%, 0% 0%; } 25% { background-position: 100% 30%, 0% 70%, 20% 40%, 80% 90%; } 50% { background-position: 50% 100%, 100% 0%, 80% 20%, 10% 60%; } 75% { background-position: 0% 40%, 30% 100%, 10% 80%, 100% 20%; } 100% { background-position: 0% 50%, 100% 50%, 50% 100%, 0% 0%; } }
          @keyframes liquidAurora { 0% { background-position: 0% 50%, 100% 50%, 50% 100%, 0% 0%; } 25% { background-position: 100% 30%, 0% 70%, 20% 40%, 80% 90%; } 50% { background-position: 50% 100%, 100% 0%, 80% 20%, 10% 60%; } 75% { background-position: 0% 40%, 30% 100%, 10% 80%, 100% 20%; } 100% { background-position: 0% 50%, 100% 50%, 50% 100%, 0% 0%; } }
          .animate-liquid-berry-canvas { background-image: radial-gradient(at 0% 0%, rgba(21, 23, 61, 0.85) 0px, transparent 55%), radial-gradient(at 100% 0%, rgba(152, 37, 152, 0.6) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(228, 145, 201, 0.55) 0px, transparent 50%), radial-gradient(at 0% 100%, rgba(241, 233, 233, 0.35) 0px, transparent 55%), radial-gradient(at 50% 50%, rgba(152, 37, 152, 0.45) 0px, transparent 60%); background-size: 200% 200%; animation: liquidAurora 24s infinite ease-in-out; }
          .glass-shell { position: relative; background: rgba(255,255,255,.015); box-shadow: 0 40px 100px -10px rgba(0,0,0,.5), inset 0 0 0 1px rgba(255,255,255,.08); }
          .glass-shell::before { content: ''; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(135deg, rgba(255,255,255,.08) 0%, rgba(255,255,255,.01) 10%, transparent 25%); border-radius: inherit; }
          .custom-scrollbar::-webkit-scrollbar { width: 6px; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,.15); border-radius: 999px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        `}</style>

        <div className="absolute inset-0 bg-[#15173d] z-0"></div>
        <div className="absolute inset-0 w-full h-full z-1 animate-liquid-berry-canvas blur-[45px] scale-105 pointer-events-none"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#15173d]/60 via-transparent to-transparent z-2 pointer-events-none"></div>

        <div className="relative z-10 h-full w-full p-6 sm:p-8">
          <div className="glass-shell relative h-full w-full rounded-[36px] overflow-hidden">
            {/* 🔥 KAPSUL BLUR: Sidebar & Halaman dibungkus di sini biar blurnya SAMA RATA 🔥 */}
            <div
              className={`flex h-full w-full transition-all duration-500 ease-in-out ${isDrawerOpen ? "blur-md brightness-50 pointer-events-none" : "blur-none brightness-100"}`}
            >
              <div className="relative z-10 h-full">
                <AdminSidebar
                  isCollapsed={isCollapsed}
                  toggleSidebar={() => setIsCollapsed(!isCollapsed)}
                />
              </div>

              <main className="flex-1 relative overflow-y-auto custom-scrollbar p-8 lg:p-10">
                <div className="absolute top-8 right-10 z-10 flex items-center gap-4">
                  <NotificationBell />
                </div>
                <div className="relative z-10 w-full">{children}</div>
              </main>
            </div>

            {/* 🔥 KAMAR DRAWER: Posisinya di luar kapsul blur, jadi dia doang yang tetep tajam */}
            <div
              id="drawer-root"
              className="absolute inset-0 z-[100] pointer-events-none"
            ></div>
          </div>
        </div>
      </div>
    </DrawerContext.Provider>
  );
}
