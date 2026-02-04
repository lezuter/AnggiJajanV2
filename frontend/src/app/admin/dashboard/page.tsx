"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link"; 

// Tipe Data
interface DashboardStats {
  income: number;
  transactions: number;
  products: number;
  expired_banners: number; 
  recent: any[];
}

export default function DashboardOverview() {
  const router = useRouter();

  // STATE
  const [stats, setStats] = useState<DashboardStats>({
    income: 0, transactions: 0, products: 0, expired_banners: 0, recent: [],
  });
  
  const [digiflazzBalance, setDigiflazzBalance] = useState<number | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // FETCH DATA
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/admin/login"); return; }
    
    const headers = { "Authorization": `Bearer ${token}` };

    const fetchInternalStats = async () => {
        try {
            const res = await fetch("http://localhost:3001/api/admin/dashboard", { headers });
            if (res.status === 401) { localStorage.removeItem("token"); router.push("/admin/login"); return; }
            const data = await res.json();
            setStats(data);
        } catch (err) { console.error("Gagal load stats", err); } 
        finally { setLoadingStats(false); }
    };

    const fetchDigiflazz = async () => {
        try {
            const res = await fetch("http://localhost:3001/api/admin/digiflazz-balance", { headers });
            if (res.ok) {
                const data = await res.json();
                setDigiflazzBalance(data.balance);
            } else { setDigiflazzBalance(-1); }
        } catch (err) { setDigiflazzBalance(-1); }
    };

    fetchInternalStats();
    fetchDigiflazz();
  }, [router]);

  // Helper Copy SN
  const copyToClipboard = (text: string) => {
    if(!text) return;
    navigator.clipboard.writeText(text);
    alert("Copied: " + text);
  };

  if (loadingStats) return <div className="p-10 text-center text-white animate-pulse">🚀 Menyiapkan Dashboard...</div>;

  return (
    <div className="p-6 w-full max-w-[1920px] mx-auto pb-20">
      
      {/* HEADER & QUICK NAV */}
      <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            📊 Overview Toko
          </h1>
          <p className="text-gray-400 text-sm mt-1">Pantau performa hari ini.</p>
        </div>
        
        {/* NAVIGASI CEPAT (Jalan Pintas) */}
        <div className="flex gap-2">
            <Link href="/admin/manual-order" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold shadow-lg transition-transform hover:scale-105 flex items-center gap-2">
                ⚡ Inject Manual
            </Link>
            <Link href="/admin/products" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-sm font-bold border border-gray-700 transition-transform hover:scale-105 flex items-center gap-2">
                📦 Produk
            </Link>
        </div>
      </div>

      {/* --- 1. STATS CARDS (NEON STYLE) --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        
        {/* CARD 1: SALDO DIGI */}
        <div className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-2xl p-6 relative overflow-hidden group hover:border-gray-600 transition-colors">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-16 h-16 text-white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H10.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.39-2.1 1.39-1.6 0-2.23-.72-2.32-1.64H8.04c.1 1.7 1.36 2.66 2.86 2.97V19h2.34v-1.67c1.52-.29 2.72-1.16 2.73-2.77-.01-2.2-1.9-2.96-3.66-3.42z"/></svg>
          </div>
          <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Sisa Saldo Digiflazz</h3>
          {digiflazzBalance === null ? (
              <div className="h-8 w-32 bg-gray-700/50 rounded animate-pulse mt-2"></div>
          ) : (
              <p className={`text-3xl font-mono font-bold mt-1 ${digiflazzBalance < 100000 ? "text-red-500" : "text-white"}`}>
                 {digiflazzBalance === -1 ? "Error" : `Rp ${digiflazzBalance.toLocaleString("id-ID")}`}
              </p>
          )}
        </div>

        {/* CARD 2: OMZET */}
        <div className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-2xl p-6 relative overflow-hidden group hover:border-green-500/30 transition-colors">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-16 h-16 text-green-500"><path d="M7 2h10v2H7V2zm0 4h10v2H7V6zm0 4h10v2H7v-2zm-2 4h14v10H5V14zm2 2v6h10v-6H7z"/></svg>
          </div>
          <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Omzet Masuk</h3>
          <p className="text-3xl font-mono font-bold text-green-400 mt-1 drop-shadow-[0_0_5px_rgba(34,197,94,0.5)]">
            Rp {stats.income.toLocaleString("id-ID")}
          </p>
        </div>

        {/* CARD 3: TRANSAKSI */}
        <div className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-2xl p-6 relative overflow-hidden group hover:border-blue-500/30 transition-colors">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-16 h-16 text-blue-500"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 9h-2V7h2v5zm0 4h-2v-2h2v2z"/></svg>
          </div>
          <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Total Order</h3>
          <p className="text-3xl font-mono font-bold text-blue-400 mt-1">
            {stats.transactions} <span className="text-sm text-gray-500 font-sans font-normal">Trx</span>
          </p>
        </div>

        {/* CARD 4: PRODUK */}
        <div className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-2xl p-6 relative overflow-hidden group hover:border-purple-500/30 transition-colors">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-16 h-16 text-purple-500"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/></svg>
          </div>
          <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Total Produk</h3>
          <p className="text-3xl font-mono font-bold text-purple-400 mt-1">
            {stats.products} <span className="text-sm text-gray-500 font-sans font-normal">Item</span>
          </p>
        </div>
      </div>

      {/* --- 2. LAYOUT SPLIT (KIRI: TRANSAKSI TERAKHIR, KANAN: STATUS TOKO) --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* KOLOM KIRI: TRANSAKSI TERAKHIR */}
        <div className="lg:col-span-2">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                   ⏱️ Transaksi Terakhir
                </h3>
                <Link href="/admin/transactions" className="text-xs font-bold text-green-400 hover:text-green-300">
                    Lihat Semua →
                </Link>
            </div>
            
            <div className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
                <table className="w-full text-sm text-left text-gray-400">
                    <thead className="text-xs text-gray-500 uppercase bg-gray-900/80 border-b border-gray-800">
                        <tr>
                            <th className="px-6 py-4">Invoice</th>
                            <th className="px-6 py-4">Item</th>
                            <th className="px-6 py-4 text-right">Harga</th>
                            <th className="px-6 py-4 text-center">Status</th>
                            <th className="px-6 py-4 text-center">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                        {stats.recent.length === 0 ? (
                            <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-500">Belum ada transaksi hari ini.</td></tr>
                        ) : (
                            stats.recent.map(trx => (
                                <tr key={trx.ID} className="hover:bg-gray-800/50 transition-colors">
                                    {/* INVOICE */}
                                    <td className="px-6 py-4 font-mono font-bold text-white text-xs">
                                        {trx.invoice_id}
                                    </td>
                                    
                                    {/* ITEM */}
                                    <td className="px-6 py-4">
                                        <div className="text-gray-300 font-medium truncate max-w-[180px]">{trx.Product?.name || "-"}</div>
                                        <div className="text-[10px] text-gray-600 font-mono mt-0.5">{trx.Product?.code}</div>
                                    </td>

                                    {/* HARGA */}
                                    <td className="px-6 py-4 text-right font-mono font-bold text-gray-300">
                                        Rp {trx.amount.toLocaleString("id-ID")}
                                    </td>

                                    {/* STATUS BADGE */}
                                    <td className="px-6 py-4 text-center">
                                         <span className={`inline-flex w-[90px] justify-center items-center py-0.5 rounded-full text-[10px] font-bold border tracking-wider uppercase
                                            ${(trx.status === "PAID" || trx.status === "SUCCESS") ? "bg-green-900/20 text-green-400 border-green-500/20" :
                                              (trx.status === "UNPAID" || trx.status === "PENDING") ? "bg-yellow-900/20 text-yellow-400 border-yellow-500/20" :
                                              "bg-red-900/20 text-red-400 border-red-500/20"
                                            }
                                        `}>
                                            {trx.status}
                                        </span>
                                    </td>
                                    
                                    {/* AKSI COPY SN */}
                                    <td className="px-6 py-4 text-center">
                                        {trx.sn ? (
                                            <button 
                                                onClick={() => copyToClipboard(trx.sn)}
                                                className="text-gray-500 hover:text-green-400 transition-colors p-1" 
                                                title="Copy SN"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M7 3.5a1.5 1.5 0 0 1 1.5-1.5h7A1.5 1.5 0 0 1 17 3.5v11a1.5 1.5 0 0 1-1.5 1.5h-1v-4.5A2.5 2.5 0 0 0 12 7.5H7.5v-4z" /><path d="M4.5 7A1.5 1.5 0 0 0 3 8.5v8A1.5 1.5 0 0 0 4.5 18h7a1.5 1.5 0 0 0 1.5-1.5v-8A1.5 1.5 0 0 0 11.5 7h-7z" /></svg>
                                            </button>
                                        ) : "-"}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        {/* KOLOM KANAN: STATUS TOKO */}
        <div>
            <h3 className="text-xl font-bold text-white mb-4">📣 Status Toko</h3>
            
            {/* ALERT BOX 1: DIGI LOW */}
            {digiflazzBalance !== null && digiflazzBalance !== -1 && digiflazzBalance < 100000 && (
                <div className="bg-red-900/20 border border-red-500/30 rounded-2xl p-4 mb-4 flex items-start gap-3">
                    <span className="text-2xl">⚠️</span>
                    <div>
                        <h4 className="text-red-400 font-bold text-sm">Saldo Menipis!</h4>
                        <p className="text-red-300/70 text-xs mt-1">Segera topup Digiflazz biar transaksi ga macet.</p>
                    </div>
                </div>
            )}

            {/* QUICK ACTIONS - FIX CSS CONFLICT DISINI */}
            <div className="bg-gray-800 border border-gray-700 rounded-2xl p-5">
                <h4 className="text-white font-bold text-sm mb-4 border-b border-gray-700 pb-2">Menu Cepat</h4>
                <div className="space-y-2">
                     <Link href="/admin/banners" className="w-full text-left px-4 py-3 bg-gray-900 hover:bg-gray-700 rounded-xl text-xs text-gray-300 transition-colors flex justify-between group">
                        <span>🖼️ Atur Banner Promo</span>
                        <span className="group-hover:translate-x-1 transition-transform">→</span>
                     </Link>
                     <Link href="/admin/users" className="w-full text-left px-4 py-3 bg-gray-900 hover:bg-gray-700 rounded-xl text-xs text-gray-300 transition-colors flex justify-between group">
                        <span>👥 Kelola Member</span>
                        <span className="group-hover:translate-x-1 transition-transform">→</span>
                     </Link>
                     <Link href="/settings" className="w-full text-left px-4 py-3 bg-gray-900 hover:bg-gray-700 rounded-xl text-xs text-gray-300 transition-colors flex justify-between group">
                        <span>⚙️ Pengaturan Website</span>
                        <span className="group-hover:translate-x-1 transition-transform">→</span>
                     </Link>
                </div>
            </div>

        </div>

      </div>

    </div>
  );
}