"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

// Tipe Data Transaksi
interface Transaction {
  ID: number;
  invoice_id: string;
  customer_phone: string;
  amount: number;
  status: string;
  payment_method: string;
  payment_url: string;
  sn: string;
  Product?: {
    name: string;
    code: string;
  };
  CreatedAt: string;
}

export default function TransactionsPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  
  // State Pencarian & Pagination
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1); // 👈 Halaman Aktif
  const itemsPerPage = 10; // 👈 Jumlah item per halaman

  // Helper: Ambil Token
  const getToken = () => {
    if (typeof window !== "undefined") {
        const token = localStorage.getItem("token");
        if (!token) {
             router.push("/admin/login");
             return null;
        }
        return token;
    }
    return null;
  };

  // 1. FETCH TRANSAKSI
  const fetchTrx = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    try {
      const res = await fetch("http://localhost:3001/api/admin/transactions", {
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (res.status === 401) {
        localStorage.removeItem("token");
        router.push("/admin/login");
        return;
      }

      const data = await res.json();
      setTransactions(Array.isArray(data) ? data : data.data || []);
    } catch (error) {
      console.error("Gagal load transaksi", error);
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Effect: Load Awal & Auto Refresh
  useEffect(() => {
    fetchTrx();
    const interval = setInterval(fetchTrx, 10000); 
    return () => clearInterval(interval);
  }, [fetchTrx]);

  // Reset Halaman ke 1 kalau user lagi ngetik search
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  // 2. LOGIKA SEARCH
  const filteredTrx = transactions.filter((t) => {
    const keyword = search.toLowerCase();
    const productName = t.Product?.name?.toLowerCase() || "";
    const invoice = t.invoice_id.toLowerCase();
    const phone = t.customer_phone.toLowerCase();
    const sn = t.sn?.toLowerCase() || "";
    const status = t.status.toLowerCase();

    return (
      invoice.includes(keyword) ||
      phone.includes(keyword) ||
      productName.includes(keyword) ||
      sn.includes(keyword) ||
      status.includes(keyword)
    );
  });

  // 3. LOGIKA PAGINATION (Slice Data)
  const totalPages = Math.ceil(filteredTrx.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredTrx.slice(indexOfFirstItem, indexOfLastItem);

  // Helper Ganti Halaman
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Helper: Copy SN
  const copyToClipboard = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    alert("Berhasil disalin: " + text);
  };

  return (
    <div className="p-6 w-full max-w-[1920px] mx-auto min-h-screen pb-20">
      
      {/* HEADER & SEARCH */}
      <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            📜 Riwayat Transaksi
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Pantau semua orderan masuk secara real-time.
          </p>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          {/* SEARCH INPUT */}
          <div className="relative w-full md:w-72">
             <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <svg className="w-4 h-4 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"/>
                </svg>
            </div>
            <input 
                type="text" 
                className="block w-full p-3 pl-10 text-sm bg-gray-900 border border-gray-700 rounded-xl focus:ring-green-500 focus:border-green-500 placeholder-gray-600 text-white outline-none transition-all shadow-lg" 
                placeholder="Cari Invoice / HP / SN..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* REFRESH BUTTON */}
          <button 
            onClick={fetchTrx}
            className="p-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl border border-gray-700 transition-all active:scale-95 group shadow-lg"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-5 h-5 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </button>
        </div>
      </div>

      {/* TABEL DATA */}
      <div className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-2xl overflow-hidden shadow-2xl relative">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-400">
            <thead className="text-xs text-gray-500 uppercase bg-gray-900/80 border-b border-gray-800">
              <tr>
                <th scope="col" className="px-6 py-4">Invoice & Waktu</th>
                <th scope="col" className="px-6 py-4">Produk</th>
                <th scope="col" className="px-6 py-4">Tujuan (HP)</th>
                <th scope="col" className="px-6 py-4 text-right">Nominal</th>
                <th scope="col" className="px-6 py-4 text-center">Status</th>
                <th scope="col" className="px-6 py-4">SN / Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading && transactions.length === 0 ? (
                // LOADING
                [...Array(5)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                        <td colSpan={6} className="px-6 py-4"><div className="h-4 bg-gray-800 rounded w-full"></div></td>
                    </tr>
                ))
              ) : filteredTrx.length === 0 ? (
                // KOSONG
                <tr>
                    <td colSpan={6} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center justify-center opacity-50">
                            <span className="text-4xl mb-2">🏜️</span>
                            <p className="text-gray-500 font-bold">Data tidak ditemukan.</p>
                        </div>
                    </td>
                </tr>
              ) : (
                // 👇 REAL DATA (MAPPING 'currentItems' BUKAN 'filteredTrx' LAGI)
                currentItems.map((trx) => (
                  <tr key={trx.ID} className="hover:bg-gray-800/50 transition-colors group">
                    
                    {/* INVOICE */}
                    <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`font-bold font-mono text-sm ${search && trx.invoice_id.toLowerCase().includes(search.toLowerCase()) ? "text-green-400" : "text-white"}`}>
                            {trx.invoice_id}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                            {new Date(trx.CreatedAt).toLocaleString("id-ID", { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </td>

                    {/* PRODUK */}
                    <td className="px-6 py-4 font-medium text-gray-300 text-sm">
                        {trx.Product?.name || <span className="text-red-400 italic text-xs">Deleted</span>}
                        {trx.Product?.code && <div className="text-xs text-gray-600 font-mono mt-1">{trx.Product.code}</div>}
                    </td>

                    {/* HP */}
                    <td className="px-6 py-4 font-mono text-yellow-500/90 font-bold text-sm">
                        {search && trx.customer_phone.includes(search) ? (
                             <span className="bg-yellow-900/30 text-yellow-300 px-1 rounded">{trx.customer_phone}</span>
                        ) : trx.customer_phone}
                    </td>

                    {/* HARGA */}
                    <td className="px-6 py-4 text-right">
                        <div className="font-mono font-bold text-gray-300 text-sm">Rp {trx.amount.toLocaleString("id-ID")}</div>
                        <div className="text-[10px] text-gray-600 font-bold mt-0.5 uppercase">{trx.payment_method}</div>
                    </td>

                    {/* STATUS (RAMPING) */}
                    <td className="px-6 py-4 text-center">
                        <span className={`inline-flex w-[100px] justify-center items-center py-0.5 rounded-full text-[10px] font-bold border tracking-wider uppercase
                            ${(trx.status === "PAID" || trx.status === "SUCCESS") ? "bg-green-900/20 text-green-400 border-green-500/20" :
                              (trx.status === "UNPAID" || trx.status === "PENDING") ? "bg-yellow-900/20 text-yellow-400 border-yellow-500/20" :
                              "bg-red-900/20 text-red-400 border-red-500/20"
                            }
                        `}>
                             {(trx.status === "PAID" || trx.status === "SUCCESS") && <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 shadow-[0_0_5px_#22c55e]"></span>}
                             {(trx.status === "UNPAID" || trx.status === "PENDING") && <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 mr-1.5 animate-ping"></span>}
                             {(trx.status === "FAILED") && <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5"></span>}
                             {trx.status === "PAID" ? "LUNAS" : trx.status === "UNPAID" ? "BELUM BAYAR" : trx.status}
                        </span>
                    </td>

                    {/* SN */}
                    <td className="px-6 py-4">
                        {(trx.status === "PAID" || trx.status === "SUCCESS") && trx.sn ? (
                            <div onClick={() => copyToClipboard(trx.sn)} className="flex items-center gap-2 cursor-pointer group/sn max-w-[200px]" title="Salin SN">
                                <code className="text-xs font-mono truncate text-gray-400 group-hover/sn:text-green-400 transition-colors">{trx.sn}</code>
                            </div>
                        ) : (
                            <span className="text-gray-700 text-xs">-</span>
                        )}
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 👇 NAVIGASI PAGINATION (GANTENG MAKSIMAL) */}
      {!loading && filteredTrx.length > 0 && (
          <div className="flex flex-col md:flex-row justify-between items-center mt-6 gap-4">
            
            <div className="text-xs text-gray-500">
               Show <span className="text-white font-bold">{indexOfFirstItem + 1}</span> - <span className="text-white font-bold">{Math.min(indexOfLastItem, filteredTrx.length)}</span> of <span className="text-white font-bold">{filteredTrx.length}</span>
            </div>

            <div className="flex items-center gap-1 bg-gray-900 p-1 rounded-xl border border-gray-800">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                ←
              </button>

              <div className="flex gap-1 px-2">
                {[...Array(totalPages)].map((_, i) => {
                  const pageNum = i + 1;
                  // Logic biar gak kebanyakan tombol (Max 7 tombol visible)
                  if (totalPages > 7 && Math.abs(currentPage - pageNum) > 2 && pageNum !== 1 && pageNum !== totalPages) {
                    if (Math.abs(currentPage - pageNum) === 3) return <span key={pageNum} className="text-gray-600 text-xs self-end pb-1">...</span>;
                    return null;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`min-w-[32px] h-8 rounded-lg text-xs font-bold transition-all ${
                        currentPage === pageNum
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                        : "text-gray-500 hover:text-white hover:bg-gray-800"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages || totalPages === 0}
                className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                →
              </button>
            </div>
          </div>
      )}
      
    </div>
  );
}