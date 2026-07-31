"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useRef } from "react";
import {
  Home,
  ShoppingCart,
  Image as ImageIcon,
  Grid,
  Package,
  History,
  Settings,
  LogOut,
  Menu,
} from "lucide-react";

import { useFrame } from "@react-three/fiber";
import {
  useGLTF,
  Float,
  Center,
  Environment,
  Lightformer,
  ContactShadows,
  View,
} from "@react-three/drei";

function StudioSoftboxLighting() {
  return (
    <>
      <ambientLight intensity={1.5} />
      <Environment resolution={512}>
        <Lightformer
          form="rect"
          intensity={5}
          position={[0, 5, 0]}
          scale={[10, 10, 1]}
          target={[0, 0, 0]}
        />
        <Lightformer
          form="rect"
          intensity={4}
          position={[-5, 0, 5]}
          scale={[5, 10, 1]}
          target={[0, 0, 0]}
          color="#ffffff"
        />
        <Lightformer
          form="rect"
          intensity={4}
          position={[5, 0, 5]}
          scale={[5, 10, 1]}
          target={[0, 0, 0]}
          color="#e491c9"
        />
        <Lightformer
          form="rect"
          intensity={5}
          position={[0, 0, -5]}
          scale={[10, 10, 1]}
          target={[0, 0, 0]}
        />
      </Environment>
    </>
  );
}

function NeonController({ isCollapsed }: { isCollapsed: boolean }) {
  const { scene } = useGLTF("/animations/model_1781361231466.gltf");
  const groupRef = useRef<any>(null);

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.2;
    }
  });

  return (
    <Float speed={1} rotationIntensity={0} floatIntensity={1.5}>
      <group ref={groupRef}>
        <Center>
          <primitive object={scene} scale={isCollapsed ? 0.028 : 0} />
        </Center>
      </group>
    </Float>
  );
}

interface AdminSidebarProps {
  isCollapsed: boolean;
  toggleSidebar: () => void;
}

export default function AdminSidebar({
  isCollapsed,
  toggleSidebar,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const isActive = (path: string) => pathname === path;

  const menuClass = (path: string) => {
    return `relative flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-300 group overflow-hidden ${
      isActive(path)
        ? "bg-white/[0.08] text-white font-bold shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),0_4px_12px_rgba(0,0,0,0.2)] border border-white/[0.05] border-t-white/[0.15]"
        : "text-slate-400 hover:bg-white/[0.04] hover:text-white border border-transparent"
    }`;
  };

  return (
    <aside
      className={`relative h-full flex-shrink-0 z-20 bg-white/[0.02] backdrop-blur-[40px] border-r border-white/[0.05] flex flex-col transition-all duration-300 ${
        isCollapsed ? "w-[80px]" : "w-64"
      }`}
    >
      <div
        className={`relative z-10 p-6 flex items-center min-h-[96px] ${
          isCollapsed ? "justify-center" : "justify-between"
        }`}
      >
        <div
          className={`transition-all duration-300 overflow-hidden whitespace-nowrap ${
            isCollapsed
              ? "w-0 opacity-0 pointer-events-none"
              : "w-full opacity-100"
          }`}
        >
          <span className="text-[8px] font-bold text-purple-300/50 uppercase tracking-[0.3em] block mb-1">
            Admin Portal
          </span>
          <h1 className="text-xl font-black tracking-tight text-white uppercase drop-shadow-md">
            ANGGI
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#e491c9] to-[#F1E9E9]">
              JAJAN
            </span>
          </h1>
        </div>

        <div
          onClick={isCollapsed ? toggleSidebar : undefined}
          className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 shrink-0 flex items-center justify-center transition-all duration-500 delay-100 hover:duration-50 hover:delay-0 ${
            isCollapsed
              ? "opacity-100 scale-100 visible cursor-pointer hover:scale-110 hover:drop-shadow-[0_0_10px_rgba(228,145,201,0.4)]"
              : "opacity-0 scale-50 invisible pointer-events-none"
          }`}
          title={isCollapsed ? "Expand Sidebar" : ""}
        >
          <div className="absolute inset-[-10px] z-50 pointer-events-none">
            <View
              className={`
                  w-full h-full transition-opacity duration-500
                  ${isCollapsed ? "opacity-100" : "opacity-0"}
                `}
            >
              <StudioSoftboxLighting />
              <Suspense fallback={null}>
                <NeonController isCollapsed={isCollapsed} />
                <ContactShadows
                  position={[0, -1.2, 0]}
                  opacity={isCollapsed ? 0.6 : 0}
                  scale={4}
                  blur={2.5}
                  far={4}
                  color="#000000"
                />
              </Suspense>
            </View>
          </div>
        </div>

        <button
          onClick={toggleSidebar}
          className={`p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors ${
            isCollapsed ? "hidden" : "block"
          }`}
        >
          <Menu size={18} />
        </button>
      </div>

      <nav className="relative z-10 flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
        <div>
          {!isCollapsed && (
            <p className="text-purple-300/50 text-[9px] uppercase tracking-widest mb-3 ml-2 font-bold">
              Overview
            </p>
          )}
          <ul className="space-y-1">
            <li>
              <Link
                href="/admin/dashboard"
                className={menuClass("/admin/dashboard")}
              >
                {isActive("/admin/dashboard") && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-gradient-to-b from-[#e491c9] to-white rounded-r-md shadow-[0_0_8px_rgba(228,145,201,0.6)]"></div>
                )}
                <Home
                  size={20}
                  className={
                    isActive("/admin/dashboard") ? "text-[#E491C9]" : ""
                  }
                />
                {!isCollapsed && (
                  <span className="text-xs tracking-wide uppercase">
                    Dashboard
                  </span>
                )}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          {!isCollapsed && (
            <p className="text-purple-300/50 text-[9px] uppercase tracking-widest mb-3 ml-2 font-bold">
              Sales & Orders
            </p>
          )}
          <ul className="space-y-1">
            <li>
              <Link
                href="/admin/manual-order"
                className={menuClass("/admin/manual-order")}
              >
                {isActive("/admin/manual-order") && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-gradient-to-b from-[#e491c9] to-white rounded-r-md shadow-[0_0_8px_rgba(228,145,201,0.6)]"></div>
                )}
                <ShoppingCart
                  size={20}
                  className={
                    isActive("/admin/manual-order") ? "text-[#E491C9]" : ""
                  }
                />
                {!isCollapsed && (
                  <span className="text-xs tracking-wide uppercase">
                    Inject Manual
                  </span>
                )}
              </Link>
            </li>
            <li>
              <Link
                href="/admin/transactions"
                className={menuClass("/admin/transactions")}
              >
                {isActive("/admin/transactions") && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-gradient-to-b from-[#e491c9] to-white rounded-r-md shadow-[0_0_8px_rgba(228,145,201,0.6)]"></div>
                )}
                <History
                  size={20}
                  className={
                    isActive("/admin/transactions") ? "text-[#E491C9]" : ""
                  }
                />
                {!isCollapsed && (
                  <span className="text-xs tracking-wide uppercase">
                    Riwayat
                  </span>
                )}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          {!isCollapsed && (
            <p className="text-purple-300/50 text-[9px] uppercase tracking-widest mb-3 ml-2 font-bold">
              Catalog
            </p>
          )}
          <ul className="space-y-1">
            <li>
              <Link
                href="/admin/banners"
                className={menuClass("/admin/banners")}
              >
                {isActive("/admin/banners") && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-gradient-to-b from-[#e491c9] to-white rounded-r-md shadow-[0_0_8px_rgba(228,145,201,0.6)]"></div>
                )}
                <ImageIcon
                  size={20}
                  className={isActive("/admin/banners") ? "text-[#E491C9]" : ""}
                />
                {!isCollapsed && (
                  <span className="text-xs tracking-wide uppercase">
                    Banners
                  </span>
                )}
              </Link>
            </li>
            <li>
              <Link
                href="/admin/catalogs"
                className={menuClass("/admin/catalogs")}
              >
                {isActive("/admin/catalogs") && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-gradient-to-b from-[#e491c9] to-white rounded-r-md shadow-[0_0_8px_rgba(228,145,201,0.6)]"></div>
                )}
                <Grid
                  size={20}
                  className={
                    isActive("/admin/catalogs") ? "text-[#E491C9]" : ""
                  }
                />
                {!isCollapsed && (
                  <span className="text-xs tracking-wide uppercase">
                    Catalogs
                  </span>
                )}
              </Link>
            </li>
            <li>
              <Link
                href="/admin/products"
                className={menuClass("/admin/products")}
              >
                {isActive("/admin/products") && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-gradient-to-b from-[#e491c9] to-white rounded-r-md shadow-[0_0_8px_rgba(228,145,201,0.6)]"></div>
                )}
                <Package
                  size={20}
                  className={
                    isActive("/admin/products") ? "text-[#E491C9]" : ""
                  }
                />
                {!isCollapsed && (
                  <span className="text-xs tracking-wide uppercase">
                    Produk
                  </span>
                )}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          {!isCollapsed && (
            <p className="text-purple-300/50 text-[9px] uppercase tracking-widest mb-3 ml-2 font-bold">
              System
            </p>
          )}
          <ul className="space-y-1">
            <li>
              <Link
                href="/admin/settings"
                className={menuClass("/admin/settings")}
              >
                {isActive("/admin/settings") && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-gradient-to-b from-[#e491c9] to-white rounded-r-md shadow-[0_0_8px_rgba(228,145,201,0.6)]"></div>
                )}
                <Settings
                  size={20}
                  className={
                    isActive("/admin/settings") ? "text-[#E491C9]" : ""
                  }
                />
                {!isCollapsed && (
                  <span className="text-xs tracking-wide uppercase">
                    Pengaturan
                  </span>
                )}
              </Link>
            </li>
          </ul>
        </div>
      </nav>

      <div className="relative z-10 p-4">
        <button
          onClick={() => {
            localStorage.removeItem("token");
            window.location.href = "/admin/login";
          }}
          className={`w-full flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/40 rounded-xl transition-all duration-300 group shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] ${
            isCollapsed ? "py-3 px-0" : "py-3 px-4"
          }`}
        >
          <LogOut
            size={18}
            className="group-hover:-translate-x-1 transition-transform"
          />
          {!isCollapsed && (
            <span className="text-xs font-bold uppercase tracking-widest">
              Terminate
            </span>
          )}
        </button>
      </div>
    </aside>
  );
}
