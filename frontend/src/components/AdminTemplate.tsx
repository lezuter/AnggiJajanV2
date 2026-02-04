"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import AdminSidebar from "./AdminSidebar";
import NotificationBell from "./NotificationBell";

export default function AdminTemplate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  return (
    // 1. CONTAINER UTAMA: Balik ke Hitam Pekat & Overflow Hidden (Biar background aman)
    <div className="flex h-screen w-full bg-black text-white font-sans overflow-hidden">
      
      {/* SIDEBAR (Group 46) */}
      <AdminSidebar isCollapsed={isCollapsed} toggleSidebar={() => setIsCollapsed(!isCollapsed)} />

      {/* WRAPPER KANAN (Header + Konten) */}
      <div className={`flex-1 flex flex-col h-full transition-all duration-300 ${isCollapsed ? "ml-20" : "ml-[255px]"}`}>
        
        {/* --- HEADER BAR (Group 47) --- */}
        <header className="h-[65px] flex-shrink-0 border-b border-gray-800 bg-[#0F1014]/80 backdrop-blur-md sticky top-0 z-40 flex items-center justify-between px-8">
            <div className="text-sm text-gray-500 font-mono">
                Admin Panel <span className="text-gray-700">/</span> {pathname.split("/").pop()}
            </div>
            <div className="flex items-center gap-4">
                <NotificationBell />
            </div>
        </header>

        {/* --- AREA SCROLLABLE (Tempat Background & Konten) --- */}
        <div className="flex-1 relative overflow-y-auto custom-scrollbar">
            
            {/* 🔥 BACKGROUND LAYERS (Sesuai Request Awal) 🔥 */}
            <div className="min-h-full relative isolate">
                
                {/* Background Container Fix */}
                <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
                    {/* Layer 1: Gradient Base */}
                    <div 
                      className="absolute top-0 left-0 w-full"
                      style={{
                        height: '1772px', 
                        background: 'linear-gradient(180deg, #18230F 0%, #000000 53.37%)'
                      }}
                    />
                    {/* Layer 2: Spike Image */}
                    <div 
                      className="absolute left-0 w-full bg-no-repeat bg-top"
                      style={{
                        top: '-4px',       
                        height: '1053px',  
                        backgroundImage: "url('/green_spike_bg.png')",
                        backgroundSize: '100% auto' 
                      }}
                    />
                </div>

                {/* --- KONTEN UTAMA --- */}
                <main className="relative z-10">
                    {children}
                </main>

            </div>
        </div>

      </div>
    </div>
  );
}