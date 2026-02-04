"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

// ✅ Kita bikin Tipe Data Generic
// Jadi mau notif Banner, Stok, atau Error, strukturnya sama.
type NotificationItem = {
    id: string;
    type: "warning" | "error" | "info" | "success"; // Bisa bedain warna nanti
    title: string;
    message: string;
    link: string;
    count?: number; // Opsional (misal: "5 item")
};

export default function NotificationBell() {
    const [isOpen, setIsOpen] = useState(false);

    // State-nya sekarang Array, bukan cuma angka
    const [notifs, setNotifs] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState(true);

    const dropdownRef = useRef<HTMLDivElement>(null);

    const fetchNotifications = async () => {
        const token = localStorage.getItem("token");
        if (!token) return;

        try {
            // Masih numpang dashboard dulu (nanti bisa bikin endpoint khusus /api/notifications)
            const res = await fetch("http://localhost:3001/api/admin/dashboard", {
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();

                // 🚀 INI WADAH PENAMPUNG NOTIFIKASI
                const loadedNotifs: NotificationItem[] = [];

                // --- 1. CEK BANNER EXPIRED ---
                if (data.expired_banners > 0) {
                    loadedNotifs.push({
                        id: "banner-expired",
                        type: "warning", // Kuning
                        title: "Promo Berakhir!",
                        message: `Ada ${data.expired_banners} banner yang masa tayangnya habis.`,
                        link: "/admin/banners",
                        count: data.expired_banners
                    });
                }

                // --- 2. CEK SALDO DIGIFLAZZ (CONTOH MASA DEPAN) ---
                // Nanti lu tinggal uncomment atau tambah logic ini:
                /*
                if (data.digiflazz_balance < 50000) {
                    loadedNotifs.push({
                        id: "low-balance",
                        type: "error", // Merah
                        title: "Saldo Kritis!",
                        message: "Saldo Digiflazz tinggal dikit, buruan topup!",
                        link: "/admin/settings",
                    });
                }
                */

                // --- 3. CEK TRANSAKSI GAGAL (CONTOH MASA DEPAN) ---
                /*
                if (data.failed_transactions > 0) {
                    loadedNotifs.push({
                        id: "trx-failed",
                        type: "error",
                        title: "Transaksi Gagal",
                        message: `${data.failed_transactions} order gagal diproses provider.`,
                        link: "/admin/transactions",
                    });
                }
                */

                setNotifs(loadedNotifs);
            }
        } catch (error) {
            console.error("Gagal cek notif");
        } finally {
            setLoading(false);
        }
    };

    // Fetch notifikasi saat komponen mount dan setiap 5 detik
    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 5000);
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                fetchNotifications();
            }
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            clearInterval(interval);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, []);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [dropdownRef]);

    // Helper Warna Icon berdasarkan Tipe
    const getIconColor = (type: string) => {
        switch (type) {
            case "error": return "bg-red-500/20 text-red-500 border-red-500/10";
            case "warning": return "bg-yellow-500/20 text-yellow-500 border-yellow-500/10";
            case "success": return "bg-green-500/20 text-green-500 border-green-500/10";
            default: return "bg-blue-500/20 text-blue-500 border-blue-500/10";
        }
    };

    // Helper Icon berdasarkan Tipe
    const getIconSymbol = (type: string) => {
        switch (type) {
            case "error": return "🚨";
            case "warning": return "⚠️";
            case "success": return "✅";
            default: return "ℹ️";
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-all active:scale-95"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                </svg>

                {/* Titik Merah (Cuma muncul kalo ada data) */}
                {!loading && notifs.length > 0 && (
                    <span className="absolute top-1.5 right-2 flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border border-gray-900"></span>
                    </span>
                )}
            </button>

            {/* DROPDOWN MENU */}
            {isOpen && (
                <div className="absolute right-0 mt-3 w-80 bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 origin-top-right">

                    <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
                        <h3 className="font-bold text-white text-sm">Notifikasi</h3>
                        {/* Indikator Jumlah / Loading */}
                        {loading ? (
                            <span className="text-[10px] text-gray-400 animate-pulse">Cek status...</span>
                        ) : notifs.length > 0 ? (
                            <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full font-bold">{notifs.length} Baru</span>
                        ) : (
                            <span className="text-[10px] bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">0 Baru</span>
                        )}
                    </div>

                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                        {loading ? (
                            // TAMPILAN LOADING DALAM DROPDOWN
                            <div className="p-6 text-center text-gray-500">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mx-auto mb-2"></div>
                                <p className="text-xs">Sinkronisasi data...</p>
                            </div>
                        ) : notifs.length > 0 ? (
                            notifs.map((item) => (
                                // ... (Code item notifikasi SAMA KAYAK SEBELUMNYA) ...
                                <Link
                                    key={item.id}
                                    href={item.link}
                                    onClick={() => setIsOpen(false)}
                                    className="flex items-start gap-3 p-4 hover:bg-gray-700/50 transition cursor-pointer border-b border-gray-700/50 relative group"
                                >
                                    {/* ... Isi item notif ... */}
                                    <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${getIconColor(item.type)}`}>
                                        {getIconSymbol(item.type)}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-200">{item.title}</p>
                                        <p className="text-xs text-gray-400 mt-1">{item.message}</p>
                                    </div>
                                </Link>
                            ))
                        ) : (
                            // TAMPILAN KOSONG (AMAN)
                            <div className="py-12 px-6 text-center text-gray-500 flex flex-col items-center opacity-60">
                                <span className="text-4xl mb-3 grayscale">🛡️</span>
                                <p className="text-sm font-medium text-gray-300">Semua Aman!</p>
                                <p className="text-xs mt-1 max-w-[200px]">Gak ada banner expired atau masalah sistem saat ini.</p>
                            </div>
                        )}
                    </div>

                    {/* Footer Refresh */}
                    <div className="p-2 bg-gray-900/50 border-t border-gray-700 text-center">
                        <button onClick={() => { setLoading(true); fetchNotifications(); }} className="text-[10px] text-gray-400 hover:text-white transition uppercase tracking-wider font-bold flex items-center justify-center gap-1 w-full">
                            {loading ? "Refreshing..." : "Refresh Status ↻"}
                        </button>
                    </div>

                </div>
            )}
        </div>
    );
}