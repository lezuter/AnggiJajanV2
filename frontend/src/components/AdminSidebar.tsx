"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Home, 
  ShoppingCart, 
  Image as ImageIcon, 
  Grid, 
  Package, 
  History, 
  Settings, 
  LogOut,
  Gamepad2 
} from "lucide-react";

// 🔥 TAMBAHAN: Interface biar Sidebar tau dia bakal dapet props ini
interface AdminSidebarProps {
  isCollapsed: boolean;
  toggleSidebar: () => void;
}

export default function AdminSidebar({ isCollapsed, toggleSidebar }: AdminSidebarProps) {
  const pathname = usePathname();
  const isActive = (path: string) => pathname === path;

  // Helper class buat menu item
  const menuClass = (path: string) => `
    flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group
    ${isActive(path) 
      ? "bg-[#9EFFBA] text-black font-bold shadow-[0_0_10px_rgba(158,255,186,0.2)]" 
      : "text-gray-400 hover:bg-[#1a1a1a] hover:text-white"
    }
  `;

  return (
    <aside 
      className={`h-screen bg-black border-r border-[#333333] fixed top-0 left-0 flex flex-col z-50 transition-all duration-300 font-mono ${isCollapsed ? "w-[80px]" : "w-[255px]"}`}
    >
      
      {/* 1. LOGO AREA */}
      <div className="h-[65px] flex items-center justify-center border-b border-[#333333]">
        <div className="flex items-center gap-3">
          <Gamepad2 size={28} className="text-white" />
          {/* Sembunyiin teks kalo lagi collapsed */}
          {!isCollapsed && (
            <span className="text-lg text-white tracking-widest uppercase font-bold font-minecraft">
              ANGGIJAJAN
            </span>
          )}
        </div>
      </div>

      {/* 2. MENU LIST */}
      <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-6 custom-scrollbar">
        
        {/* MAIN MENU */}
        <div>
            {!isCollapsed && <p className="text-[#9EFFBA] text-[10px] uppercase tracking-widest mb-2 ml-2 font-bold">MAIN MENU</p>}
            <ul className="space-y-1">
                <li>
                    <Link href="/admin/dashboard" className={menuClass("/admin/dashboard")}>
                        <Home size={20} className="shrink-0" />
                        {!isCollapsed && <span className="text-xs tracking-wide uppercase">Overview</span>}
                    </Link>
                </li>
                <li>
                    <Link href="/admin/manual-order" className={menuClass("/admin/manual-order")}>
                        <ShoppingCart size={20} className="shrink-0" />
                        {!isCollapsed && <span className="text-xs tracking-wide uppercase">Manual Order</span>}
                    </Link>
                </li>
            </ul>
        </div>

        {/* DATA MASTER */}
        <div>
            {!isCollapsed && <p className="text-[#9EFFBA] text-[10px] uppercase tracking-widest mb-2 ml-2 font-bold">DATA MASTER</p>}
            <ul className="space-y-1">
                <li>
                    <Link href="/admin/banners" className={menuClass("/admin/banners")}>
                        <ImageIcon size={20} className="shrink-0" />
                        {!isCollapsed && <span className="text-xs tracking-wide uppercase">Carousel</span>}
                    </Link>
                </li>
                <li>
                    <Link href="/admin/catalogs" className={menuClass("/admin/catalogs")}>
                        <Grid size={20} className="shrink-0" />
                        {!isCollapsed && <span className="text-xs tracking-wide uppercase">Catalog Card</span>}
                    </Link>
                </li>
                <li>
                    <Link href="/admin/products" className={menuClass("/admin/products")}>
                        <Package size={20} className="shrink-0" />
                        {!isCollapsed && <span className="text-xs tracking-wide uppercase">Products</span>}
                    </Link>
                </li>
                <li>
                    <Link href="/admin/transactions" className={menuClass("/admin/transactions")}>
                        <History size={20} className="shrink-0" />
                        {!isCollapsed && <span className="text-xs tracking-wide uppercase">Riwayat</span>}
                    </Link>
                </li>
            </ul>
        </div>

        {/* SYSTEM */}
        <div>
            {!isCollapsed && <p className="text-[#9EFFBA] text-[10px] uppercase tracking-widest mb-2 ml-2 font-bold">SYSTEM</p>}
            <ul className="space-y-1">
                <li>
                    <Link href="/admin/settings" className={menuClass("/admin/settings")}>
                        <Settings size={20} className="shrink-0" />
                        {!isCollapsed && <span className="text-xs tracking-wide uppercase">Pengaturan</span>}
                    </Link>
                </li>
            </ul>
        </div>

      </nav>

      {/* 3. LOGOUT BUTTON */}
      <div className="p-4 border-t border-[#333333] bg-black">
        <button 
            onClick={() => {
                localStorage.removeItem("token");
                window.location.href = "/admin/login";
            }}
            className={`w-full flex items-center justify-center gap-2 bg-[#FF0000] hover:bg-red-600 text-white rounded-lg transition-all duration-200 group shadow-[0_0_15px_rgba(255,0,0,0.3)] ${isCollapsed ? 'py-3 px-0' : 'py-3 px-4'}`}
        >
          <LogOut size={20} className="group-hover:-translate-x-1 transition-transform stroke-[2.5px]" />
          {!isCollapsed && <span className="text-xs font-bold tracking-widest uppercase">Logout</span>}
        </button>
      </div>
    </aside>
  );
}