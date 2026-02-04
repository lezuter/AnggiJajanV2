"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // Efek Scroll Transparan -> Solid
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Cek apakah ini halaman Admin (Kalau admin, navbar ini gak usah muncul/beda style)
  if (pathname.startsWith("/admin")) return null;

  return (
    <nav
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
        isScrolled ? "bg-gray-900/95 backdrop-blur-md shadow-lg py-3" : "bg-transparent py-5"
      }`}
    >
      <div className="container mx-auto px-4 flex justify-between items-center">
        
        {/* LOGO */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-500/30 transition-transform group-hover:rotate-12">
            A
          </div>
          <span className="text-xl font-bold text-white tracking-wide">
            Anggi<span className="text-indigo-400">Jajan</span>
          </span>
        </Link>

        {/* MENU DESKTOP */}
        <div className="hidden md:flex items-center gap-8">
          <Link href="/" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
            Beranda
          </Link>
          <Link href="/track" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
            🔍 Lacak Pesanan
          </Link>
          <a href="https://wa.me/628123456789" target="_blank" className="px-5 py-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-full text-sm font-bold text-white transition-all backdrop-blur-sm">
            Hubungi Admin
          </a>
        </div>

        {/* TOMBOL MOBILE */}
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden p-2 text-white"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isMobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} /></svg>
        </button>
      </div>

      {/* MENU MOBILE (Dropdown) */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-gray-900 border-t border-gray-800 p-4 absolute w-full">
          <div className="flex flex-col gap-4">
            <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className="text-gray-300 hover:text-white font-medium">Beranda</Link>
            <Link href="/track" onClick={() => setIsMobileMenuOpen(false)} className="text-gray-300 hover:text-white font-medium">Lacak Pesanan</Link>
            <hr className="border-gray-800"/>
            <a href="https://wa.me/62812345678" className="text-indigo-400 font-bold">WhatsApp Admin</a>
          </div>
        </div>
      )}
    </nav>
  );
}