"use client";

import type { TransactionKpiSummary } from "../types";

interface TransactionKPIProps {
  summary?: TransactionKpiSummary | null;
}

const emptySummary: TransactionKpiSummary = {
  total_revenue: 0,
  total_profit: 0,
  success_count: 0,
  failed_count: 0,
  pending_count: 0,
  total_count: 0,
};

export default function TransactionKPI({ summary }: TransactionKPIProps) {
  const stats = summary || emptySummary;

  const formatIDR = (val: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 mt-10">
      <div className="bg-white/[0.02] border border-white/[0.05] p-4 rounded-xl backdrop-blur-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <svg className="w-12 h-12 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total Omset</div>
        <div className="font-mono text-xl font-black text-white drop-shadow-md">{formatIDR(stats.total_revenue)}</div>
        <div className="text-[9px] text-slate-400 mt-2 font-medium">Dari {stats.success_count} Transaksi Sukses</div>
      </div>

      <div className="bg-white/[0.02] border border-white/[0.05] p-4 rounded-xl backdrop-blur-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <svg className="w-12 h-12 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
        </div>
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Cuan Bersih</div>
        <div className="font-mono text-xl font-black text-emerald-400 drop-shadow-md">{formatIDR(stats.total_profit)}</div>
        <div className="text-[9px] text-slate-400 mt-2 font-medium">Margin Keuntungan</div>
      </div>

      <div className="bg-white/[0.02] border border-white/[0.05] p-4 rounded-xl backdrop-blur-sm relative overflow-hidden">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Transaksi Gagal</div>
        <div className="font-mono text-xl font-black text-red-400 drop-shadow-md">{stats.failed_count}</div>
        <div className="text-[9px] text-slate-400 mt-2 font-medium">Butuh Pengecekan</div>
      </div>

      <div className="bg-white/[0.02] border border-white/[0.05] p-4 rounded-xl backdrop-blur-sm relative overflow-hidden">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Pending / Unpaid</div>
        <div className="font-mono text-xl font-black text-amber-400 drop-shadow-md">{stats.pending_count}</div>
        <div className="text-[9px] text-slate-400 mt-2 font-medium">Menunggu Pembayaran</div>
      </div>
    </div>
  );
}
