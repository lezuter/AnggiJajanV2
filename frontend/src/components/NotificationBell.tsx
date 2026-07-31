"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useApi } from "@/hooks/useApi"; // 🔥 IMPORT HOOK API

type NotificationItem = {
  id: string;
  type: "warning" | "error" | "info" | "success";
  title: string;
  message: string;
  link: string;
  count?: number;
};

export default function NotificationBell() {
  const api = useApi(); // 🔥 INISIALISASI
  const [isOpen, setIsOpen] = useState(false);
  const [notifs, setNotifs] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      // 🔥 CUKUP PANGGIL INI, GAK PERLU SET TOKEN MANUAL
      const res = await api.get("/admin/dashboard");

      if (res.ok) {
        const data = await res.json();
        const newNotifs: NotificationItem[] = [];

        if (data.issues_count > 0) {
          newNotifs.push({
            id: "stock-issue",
            type: "warning",
            title: "Peringatan Stok",
            message: `Ada ${data.issues_count} produk yang habis atau offline.`,
            link: "/admin/products",
            count: data.issues_count,
          });
        }
        setNotifs(newNotifs);
      }
    } catch (error) {
      console.error("Gagal load notifikasi:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  // Tutup dropdown kalau klik di luar area
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const totalNotifs = notifs.length;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-3 bg-white/5 border border-white/10 hover:bg-white/10 rounded-2xl transition-all shadow-lg hover:shadow-white/5"
      >
        <svg
          className="w-6 h-6 text-white/80"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          ></path>
        </svg>
        {totalNotifs > 0 && (
          <span className="absolute top-2 right-2 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border border-black"></span>
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-4 w-[340px] bg-[#0C1222] border border-gray-700/50 shadow-2xl rounded-2xl overflow-hidden z-[999] backdrop-blur-xl">
          <div className="px-5 py-4 bg-gradient-to-r from-gray-900 to-[#0C1222] border-b border-gray-800 flex justify-between items-center">
            <h3 className="text-sm font-bold text-white tracking-wide uppercase">
              Notifikasi
            </h3>
            <span className="bg-white/10 text-gray-300 text-[10px] font-bold px-2 py-1 rounded-lg">
              {totalNotifs} Baru
            </span>
          </div>

          <div className="max-h-[360px] overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="py-8 text-center text-sm text-gray-500 animate-pulse">
                Memeriksa sistem...
              </div>
            ) : notifs.length > 0 ? (
              notifs.map((item) => (
                <Link
                  href={item.link}
                  key={item.id}
                  className="p-4 border-b border-gray-800/50 hover:bg-white/5 transition-all flex gap-4 items-start group"
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-orange-500/10 text-orange-400 border border-orange-500/20 group-hover:scale-110 transition-transform">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      ></path>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-200">
                      {item.title}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{item.message}</p>
                  </div>
                </Link>
              ))
            ) : (
              <div className="py-12 px-6 text-center text-gray-500 flex flex-col items-center opacity-60">
                <span className="text-4xl mb-3 grayscale">🛡️</span>
                <p className="text-sm font-medium text-gray-300">Semua Aman!</p>
                <p className="text-xs mt-1 max-w-[200px]">
                  Gak ada masalah sistem saat ini.
                </p>
              </div>
            )}
          </div>

          <div className="p-2 bg-gray-900/50 border-t border-gray-700 text-center">
            <button
              onClick={() => {
                setLoading(true);
                fetchNotifications();
              }}
              className="text-[10px] text-gray-400 hover:text-white transition uppercase tracking-wider font-bold flex items-center justify-center gap-1 w-full"
            >
              {loading ? "Refreshing..." : "Refresh Status ↻"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
