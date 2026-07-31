"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";

interface DashboardStats {
  income: number;
  transactions: number;
  products: number;
  expired_banners: number;
  recent: any[];
}

// ✨ PREMIUM GLASSMORPHISM CARD ✨
const CardBase = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={`relative overflow-hidden bg-gradient-to-br from-white/[0] to-transparent backdrop-blur-[100px] backdrop-saturate-[200%] border border-white/[0.04] shadow-[0_8px_32px_0_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(255,255,255,0.02)] rounded-[28px] transition-all duration-700 ease-out hover:-translate-y-1 hover:bg-gradient-to-br hover:from-white/[0.04] hover:to-transparent hover:shadow-[0_16px_40px_0_rgba(0,0,0,0.2),inset_0_1px_2px_rgba(255,255,255,0.15)] ${className}`}
  >
    <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.15] to-transparent opacity-40" />
    <div className="relative z-10">{children}</div>
  </div>
);

export default function DashboardOverview() {
  const { get } = useApi();

  const [stats, setStats] = useState<DashboardStats>({
    income: 0,
    transactions: 0,
    products: 0,
    expired_banners: 0,
    recent: [],
  });
  const [digiflazzBalance, setDigiflazzBalance] = useState<number | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [popup, setPopup] = useState({
    isOpen: false,
    title: "",
    message: "",
    type: "info",
  });

  // Fungsi fetch data utama
  const loadDashboardData = useCallback(async () => {
    try {
      const statsRes = await get("/admin/dashboard");
      const statsData = await statsRes.json();
      setStats(statsData);

      const digiRes = await get("/admin/digiflazz-balance");
      if (digiRes.ok) {
        const digiData = await digiRes.json();
        setDigiflazzBalance(digiData.balance);
      } else {
        setDigiflazzBalance(-1);
      }
    } catch (err) {
      console.error("Data loading error:", err);
      setDigiflazzBalance(-1);
    } finally {
      setLoadingStats(false);
    }
  }, [get]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const copyToClipboard = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    alert("Copied: " + text);
  };

  const showPopup = (title: string, message: string, type: string = "info") => {
    setPopup({ isOpen: true, title, message, type });
  };

  const closePopup = () => setPopup({ ...popup, isOpen: false });

  if (loadingStats)
    return (
      <div className="flex-1 flex items-center justify-center text-white font-bold tracking-widest uppercase text-sm">
        <span className="animate-pulse">🚀 Syncing Node Data...</span>
      </div>
    );

  return (
    <div className="w-full max-w-[1920px] mx-auto pb-10">
      {/* --- BARIS 1: JUDUL SEJAJAR LONCENG --- */}
      <div className="flex justify-between items-start mb-6">
        <div className="pr-16">
          <h1 className="text-3xl font-black text-white flex items-center gap-3 uppercase tracking-tight">
            <span className="w-2 h-8 bg-gradient-to-b from-[#e491c9] to-purple-600 rounded-full"></span>
            Overview Toko
          </h1>
          <p className="text-purple-300/70 text-sm mt-1 ml-5 tracking-widest uppercase text-[10px] font-bold">
            Pantau performa infrastruktur hari ini.
          </p>
        </div>
      </div>

      {/* --- BARIS 2: TOMBOL TETAP DI KANAN, TURUN KE BAWAH LONCENG --- */}
      <div className="flex justify-end gap-3 mb-8">
        <Link
          href="/admin/manual-order"
          className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold uppercase tracking-widest border border-white/20 hover:border-white/40 transition-all flex items-center gap-2 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
        >
          ⚡ Inject Manual
        </Link>
        <Link
          href="/admin/products"
          className="px-5 py-2.5 bg-white/90 hover:bg-white text-[#15173d] rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(255,255,255,0.3)]"
        >
          📦 Produk
        </Link>
      </div>

      {/* --- 1. STATS CARDS --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <CardBase className="p-6 group flex flex-col justify-center min-h-[100px]">
          <h3 className="text-purple-300/80 text-[10px] font-bold uppercase tracking-[0.2em] mb-1">
            Digiflazz Node Balance
          </h3>
          {digiflazzBalance === null ? (
            <div className="h-8 w-32 bg-white/10 rounded animate-pulse mt-2"></div>
          ) : (
            <p
              className={`text-3xl font-mono font-bold mt-1 tracking-tight ${
                digiflazzBalance < 100000
                  ? "text-red-400 drop-shadow-md"
                  : "text-white"
              }`}
            >
              {digiflazzBalance === -1
                ? "Error"
                : `Rp ${digiflazzBalance.toLocaleString("id-ID")}`}
            </p>
          )}
        </CardBase>

        <CardBase className="p-6 group flex flex-col justify-center min-h-[100px]">
          <h3 className="text-purple-300/80 text-[10px] font-bold uppercase tracking-[0.2em] mb-1">
            Total Revenue
          </h3>
          <p className="text-3xl font-mono font-bold text-emerald-400 mt-1 drop-shadow-md tracking-tight">
            Rp {stats.income.toLocaleString("id-ID")}
          </p>
        </CardBase>

        <CardBase className="p-6 group flex flex-col justify-center min-h-[100px]">
          <h3 className="text-purple-300/80 text-[10px] font-bold uppercase tracking-[0.2em] mb-1">
            Processed Orders
          </h3>
          <p className="text-3xl font-mono font-bold text-sky-400 mt-1 drop-shadow-md tracking-tight">
            {stats.transactions}{" "}
            <span className="text-xs text-sky-200/50 font-sans tracking-widest">
              TRX
            </span>
          </p>
        </CardBase>

        <CardBase className="p-6 group flex flex-col justify-center min-h-[100px]">
          <h3 className="text-purple-300/80 text-[10px] font-bold uppercase tracking-[0.2em] mb-1">
            Active Products
          </h3>
          <p className="text-3xl font-mono font-bold text-[#e491c9] mt-1 drop-shadow-md tracking-tight">
            {stats.products}{" "}
            <span className="text-xs text-[#e491c9]/50 font-sans tracking-widest">
              ITEM
            </span>
          </p>
        </CardBase>
      </div>

      {/* --- 2. LAYOUT SPLIT --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* KOLOM KIRI: TRANSAKSI TERAKHIR */}
        <div className="lg:col-span-2">
          <CardBase className="p-8">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-lg font-bold text-white uppercase tracking-wider flex items-center">
                <span className="w-2 h-6 bg-sky-400 rounded-full mr-3 shadow-[0_0_12px_rgba(56,189,248,0.6)]"></span>
                Recent Transactions
              </h3>
              <Link
                href="/admin/transactions"
                className="text-[10px] font-bold text-purple-300 uppercase tracking-widest hover:text-white transition-all duration-300 hover:bg-white/10 py-2 px-4 rounded-full border border-white/10 hover:border-white/30 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]"
              >
                View Log →
              </Link>
            </div>

            {/* 🔥 TABLE CONTAINER: Hilangin bg-black, biarin tembus pandang murni 🔥 */}
            <div className="overflow-x-auto pb-2">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                {/* HEADER TABEL: Super tipis dan elegan */}
                <thead>
                  <tr>
                    <th className="pb-4 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-white/[0.05]">
                      Invoice
                    </th>
                    <th className="pb-4 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-white/[0.05]">
                      Payload
                    </th>
                    <th className="pb-4 px-2 text-right text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-white/[0.05]">
                      Value
                    </th>
                    <th className="pb-4 px-2 text-center text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-white/[0.05]">
                      Status
                    </th>
                    <th className="pb-4 px-2 text-center text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-white/[0.05]">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="text-sm">
                  {stats.recent.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-12 text-center text-slate-500/50 italic tracking-widest font-mono text-xs"
                      >
                        <span className="animate-pulse">
                          Awaiting new data nodes...
                        </span>
                      </td>
                    </tr>
                  ) : (
                    stats.recent.map((trx, index) => (
                      <tr
                        key={trx.ID}
                        /* 🔥 ROW HOVER: Efek ngambang (translate-y) & nyala tipis, garis bawah nyaris tak terlihat */
                        className="group hover:bg-white/[0.03] transition-all duration-300 border-b border-white/[0.02] last:border-0"
                      >
                        <td className="py-4 px-2 font-mono font-medium text-purple-300/70 text-xs group-hover:text-purple-300 transition-colors">
                          {trx.invoice_id}
                        </td>

                        <td className="py-4 px-2">
                          <div className="text-slate-200 font-medium truncate max-w-[200px] group-hover:text-white transition-colors">
                            {trx.Product?.name || "-"}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono mt-1 tracking-[0.1em] group-hover:text-slate-400 transition-colors">
                            {trx.Product?.code}
                          </div>
                        </td>

                        <td className="py-4 px-2 text-right font-mono font-bold text-slate-300 group-hover:text-white transition-colors">
                          Rp {trx.amount.toLocaleString("id-ID")}
                        </td>

                        <td className="py-4 px-2 text-center">
                          {/* 🔥 STATUS BADGE: Gaya Glowing Frosted Pill 🔥 */}
                          <span
                            className={`inline-flex w-[85px] justify-center items-center py-1.5 rounded-full text-[9px] font-bold tracking-[0.15em] uppercase border backdrop-blur-md transition-all duration-300
                                                ${
                                                  trx.status === "PAID" ||
                                                  trx.status === "SUCCESS"
                                                    ? "bg-emerald-500/[0.08] text-emerald-400 border-emerald-500/20 group-hover:shadow-[0_0_12px_rgba(16,185,129,0.2)] group-hover:bg-emerald-500/[0.12]"
                                                    : trx.status === "UNPAID" ||
                                                        trx.status === "PENDING"
                                                      ? "bg-amber-500/[0.08] text-amber-400 border-amber-500/20 group-hover:shadow-[0_0_12px_rgba(245,158,11,0.2)] group-hover:bg-amber-500/[0.12]"
                                                      : "bg-red-500/[0.08] text-red-400 border-red-500/20 group-hover:shadow-[0_0_12px_rgba(239,68,68,0.2)] group-hover:bg-red-500/[0.12]"
                                                }
                                            `}
                          >
                            {trx.status}
                          </span>
                        </td>

                        <td className="py-4 px-2 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {/* 1. ACTION SUCCESS/PAID: Copy SN (Hanya muncul jika ada SN) */}
                            {(trx.status === "PAID" ||
                              trx.status === "SUCCESS") &&
                            trx.sn ? (
                              <button
                                onClick={() => copyToClipboard(trx.sn)}
                                className="text-slate-500 hover:text-sky-400 bg-white/[0.02] hover:bg-sky-400/10 p-2 rounded-full transition-all duration-300 border border-white/[0.02] hover:border-sky-400/30 hover:shadow-[0_0_10px_rgba(56,189,248,0.2)]"
                                title="Copy SN"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                  className="w-4 h-4"
                                >
                                  <path d="M7 3.5a1.5 1.5 0 0 1 1.5-1.5h7A1.5 1.5 0 0 1 17 3.5v11a1.5 1.5 0 0 1-1.5 1.5h-1v-4.5A2.5 2.5 0 0 0 12 7.5H7.5v-4z" />
                                  <path d="M4.5 7A1.5 1.5 0 0 0 3 8.5v8A1.5 1.5 0 0 0 4.5 18h7a1.5 1.5 0 0 0 1.5-1.5v-8A1.5 1.5 0 0 0 11.5 7h-7z" />
                                </svg>
                              </button>
                            ) : null}

                            {/* 2. ACTION PENDING/UNPAID: Check Status (Nge-ping paksa provider) */}
                            {(trx.status === "PENDING" ||
                              trx.status === "UNPAID") && (
                              <button
                                onClick={() =>
                                  showPopup(
                                    "API Ping Request",
                                    `Sedang melakukan sinkronisasi status ke provider untuk invoice:\n${trx.invoice_id}`,
                                    "warning",
                                  )
                                }
                                className="text-slate-500 hover:text-amber-400 bg-white/[0.02] hover:bg-amber-400/10 p-2 rounded-full transition-all duration-300 border border-white/[0.02] hover:border-amber-400/30 hover:shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                                title="Check Status to Provider"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                  className="w-4 h-4"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </button>
                            )}

                            {/* 3. ACTION FAILED: Resolve / Retry */}
                            {trx.status === "FAILED" && (
                              <button
                                onClick={() =>
                                  showPopup(
                                    "Resolve Transaction",
                                    `Buka menu investigasi & refund untuk invoice:\n${trx.invoice_id}`,
                                    "error",
                                  )
                                }
                                className="text-slate-500 hover:text-red-400 bg-white/[0.02] hover:bg-red-400/10 p-2 rounded-full transition-all duration-300 border border-white/[0.02] hover:border-red-400/30 hover:shadow-[0_0_10px_rgba(239,68,68,0.2)]"
                                title="Resolve / Refund"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                  className="w-4 h-4"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </button>
                            )}

                            {/* 4. FALLBACK: Jika status Success/Paid tapi SN kosong, tampilkan strip */}
                            {(trx.status === "PAID" ||
                              trx.status === "SUCCESS") &&
                              !trx.sn && (
                                <span className="text-slate-600 font-bold">
                                  -
                                </span>
                              )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardBase>
        </div>

        {/* KOLOM KANAN: STATUS TOKO & QUICK MENU */}
        <div className="space-y-8">
          {/* ALERT BOX 1: DIGI LOW */}
          {digiflazzBalance !== null &&
            digiflazzBalance !== -1 &&
            digiflazzBalance < 100000 && (
              <CardBase className="p-6 flex items-start gap-4 border-red-500/20 bg-red-500/5">
                <span className="text-2xl drop-shadow-[0_0_8px_rgba(248,113,113,0.5)]">
                  ⚠️
                </span>
                <div>
                  <h4 className="text-red-400 font-bold text-sm tracking-wider uppercase">
                    Critical Warning
                  </h4>
                  <p className="text-red-300/70 text-xs mt-1 leading-relaxed">
                    Node balance depleted. Please recharge Digiflazz API
                    immediately.
                  </p>
                </div>
              </CardBase>
            )}

          {/* QUICK ACTIONS */}
          <CardBase className="p-8">
            <h4 className="text-white font-bold text-sm mb-6 border-b border-white/10 pb-3 uppercase tracking-widest flex items-center">
              <span className="w-2 h-4 bg-purple-400 rounded-full mr-2 shadow-[0_0_10px_rgba(192,132,252,0.5)]"></span>
              Quick Operations
            </h4>
            <div className="space-y-3">
              <Link
                href="/admin/banners"
                className="w-full text-left px-5 py-4 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 rounded-xl text-xs font-bold tracking-widest uppercase text-slate-300 hover:text-white transition-all flex justify-between group shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]"
              >
                <span className="flex items-center gap-3">
                  <span className="text-lg">🖼️</span> Modify Banners
                </span>
                <span className="group-hover:translate-x-1 transition-transform text-[#e491c9]">
                  →
                </span>
              </Link>
              <Link
                href="/admin/users"
                className="w-full text-left px-5 py-4 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 rounded-xl text-xs font-bold tracking-widest uppercase text-slate-300 hover:text-white transition-all flex justify-between group shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]"
              >
                <span className="flex items-center gap-3">
                  <span className="text-lg">👥</span> User Database
                </span>
                <span className="group-hover:translate-x-1 transition-transform text-[#e491c9]">
                  →
                </span>
              </Link>
              <Link
                href="/settings"
                className="w-full text-left px-5 py-4 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 rounded-xl text-xs font-bold tracking-widest uppercase text-slate-300 hover:text-white transition-all flex justify-between group shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]"
              >
                <span className="flex items-center gap-3">
                  <span className="text-lg">⚙️</span> System Config
                </span>
                <span className="group-hover:translate-x-1 transition-transform text-[#e491c9]">
                  →
                </span>
              </Link>
            </div>
          </CardBase>
        </div>
      </div>

      {/* --- 🔥 CUSTOM MODAL POPUP (GLASSMORPHISM) 🔥 --- */}
      {popup.isOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all duration-300">
          {/* Efek klik di luar modal buat nutup (Backdrop) */}
          <div className="absolute inset-0" onClick={closePopup}></div>

          {/* Modal Card */}
          <div className="relative w-full max-w-md overflow-hidden bg-gradient-to-br from-white/[0.05] to-transparent backdrop-blur-[40px] backdrop-saturate-[200%] border border-white/[0.08] shadow-[0_16px_40px_0_rgba(0,0,0,0.5),inset_0_1px_2px_rgba(255,255,255,0.15),inset_0_-1px_2px_rgba(255,255,255,0.05)] rounded-[32px] p-8 animate-in fade-in zoom-in-95 duration-300">
            {/* Highlight Lensa */}
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.3] to-transparent opacity-50" />

            <div className="relative z-10">
              {/* Icon / Indikator Warna */}
              <div className="flex items-center gap-4 mb-4">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border shadow-[inset_0_1px_2px_rgba(255,255,255,0.2)]
                  ${
                    popup.type === "warning"
                      ? "bg-amber-500/20 border-amber-500/30 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                      : popup.type === "error"
                        ? "bg-red-500/20 border-red-500/30 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                        : "bg-sky-500/20 border-sky-500/30 text-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.2)]"
                  }`}
                >
                  {popup.type === "warning"
                    ? "⚡"
                    : popup.type === "error"
                      ? "⚠️"
                      : "ℹ️"}
                </div>
                <h3 className="text-xl font-bold text-white tracking-wide">
                  {popup.title}
                </h3>
              </div>

              {/* Message */}
              <p className="text-slate-300 text-sm font-mono tracking-tight leading-relaxed mb-8 whitespace-pre-wrap">
                {popup.message}
              </p>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={closePopup}
                  className="px-6 py-2.5 bg-white/[0.02] hover:bg-white/[0.08] text-slate-300 hover:text-white rounded-xl text-xs font-bold uppercase tracking-widest border border-white/[0.05] hover:border-white/[0.15] transition-all duration-300"
                >
                  Cancel
                </button>
                <button
                  onClick={closePopup}
                  className={`px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest border transition-all duration-300 shadow-[inset_0_1px_2px_rgba(255,255,255,0.2)]
                    ${
                      popup.type === "warning"
                        ? "bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/30 hover:border-amber-500/50 hover:shadow-[0_0_15px_rgba(245,158,11,0.3)]"
                        : popup.type === "error"
                          ? "bg-red-500/20 hover:bg-red-500/30 text-red-300 border-red-500/30 hover:border-red-500/50 hover:shadow-[0_0_15px_rgba(239,68,68,0.3)]"
                          : "bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border-sky-500/30 hover:border-sky-500/50 hover:shadow-[0_0_15px_rgba(56,189,248,0.3)]"
                    }`}
                >
                  Proceed Execute
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
