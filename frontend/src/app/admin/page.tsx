"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Sesuaikan interface sama respon Backend (dashboard_controller.go)
interface DashboardStats {
  income: number;          // Backend: "income"
  transactions: number;    // Backend: "transactions"
  products: number;        // Backend: "products"
  expired_banners: number; // Backend: "expired_banners"
  recent: any[];           // Backend: "recent"
}

export default function AdminDashboard() {
  const router = useRouter();

  // State Stats (Default 0 biar gak error)
  const [stats, setStats] = useState<DashboardStats>({
    income: 0,
    transactions: 0,
    products: 0,
    expired_banners: 0,
    recent: [],
  });

  const [digiflazzBalance, setDigiflazzBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/admin/login");
      return;
    }

    const headers = {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    };

    try {
      // 1. Ambil Statistik Internal (Database)
      const resStats = await fetch("http://localhost:3001/api/admin/dashboard", { headers });
      if (resStats.ok) {
        const dataStats = await resStats.json();
        setStats(dataStats); // Update state dengan data backend
      }

      // 2. Ambil Saldo Digiflazz (Realtime)
      const resBalance = await fetch("http://localhost:3001/api/admin/digiflazz-balance", { headers });
      if (resBalance.ok) {
        const dataBalance = await resBalance.json();
        setDigiflazzBalance(dataBalance.balance);
      }

    } catch (error) {
      console.error("Gagal load dashboard", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-white mb-8">Dashboard Admin</h1>

      {/* GRID KARTU STATISTIK */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">

        {/* KARTU 1: SALDO DIGIFLAZZ */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-6 rounded-2xl shadow-lg border border-blue-500/30 relative overflow-hidden group">
          <div className="absolute right-0 top-0 opacity-10 transform translate-x-4 -translate-y-4">
            <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" /><path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" /></svg>
          </div>
          <p className="text-blue-200 text-sm font-medium uppercase tracking-wider">Saldo Digiflazz (Modal)</p>
          <h2 className="text-4xl font-bold text-white mt-2">
            {/* Pake safe check (?? 0) biar gak error toLocaleString */}
            Rp {(digiflazzBalance ?? 0).toLocaleString("id-ID")}
          </h2>
          <p className="text-xs text-blue-300 mt-4 opacity-80">
            *Realtime dari server Digiflazz
          </p>
        </div>

        {/* KARTU 2: TOTAL OMZET */}
        <div className="bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-700">
          <p className="text-gray-400 text-sm font-medium uppercase">Total Omzet Masuk</p>
          <h2 className="text-3xl font-bold text-green-400 mt-2">
            {/* GANTI 'revenue' JADI 'income' (Sesuai Backend) */}
            Rp {(stats.income ?? 0).toLocaleString("id-ID")}
          </h2>
          <div className="mt-4 h-1 w-full bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 w-3/4"></div>
          </div>
        </div>

        {/* KARTU 3: TRANSAKSI */}
        <div className="bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-700">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-gray-400 text-sm font-medium uppercase">Total Transaksi</p>
              <h2 className="text-3xl font-bold text-white mt-2">
                {/* GANTI 'total_trx' JADI 'transactions' */}
                {(stats.transactions ?? 0).toLocaleString("id-ID")} <span className="text-lg text-gray-500">Trx</span>
              </h2>
            </div>
            <div className="text-right">
              <p className="text-gray-400 text-xs uppercase mb-1">Produk Aktif</p>
              <span className="bg-purple-500/20 text-purple-400 px-3 py-1 rounded-lg font-bold">
                {stats.products} Item
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* TABEL TRANSAKSI TERBARU */}
      <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
        <h3 className="text-xl font-bold text-white mb-4">Transaksi Terbaru</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-gray-300">
            <thead className="bg-gray-900 text-gray-400 uppercase text-xs">
              <tr>
                <th className="p-3">Invoice</th>
                <th className="p-3">Item</th>
                <th className="p-3">Harga</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700 text-sm">
              {stats.recent.length === 0 ? (
                <tr><td colSpan={4} className="p-4 text-center text-gray-500">Belum ada transaksi</td></tr>
              ) : (
                stats.recent.map((trx: any) => (
                  <tr key={trx.ID} className="hover:bg-gray-700/50">
                    <td className="p-3 font-mono text-xs">{trx.invoice_id}</td>
                    <td className="p-3">{trx.Product?.name || "Produk dihapus"}</td>
                    <td className="p-3 text-green-400">Rp {trx.amount.toLocaleString("id-ID")}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold ${trx.status === 'PAID' ? 'bg-green-900 text-green-400' :
                          trx.status === 'PENDING' ? 'bg-yellow-900 text-yellow-400' :
                            'bg-red-900 text-red-400'
                        }`}>
                        {trx.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}