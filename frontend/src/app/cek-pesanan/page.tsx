"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar"; // Pastikan path Navbar sesuai

export default function CekPesananPage() {
  const [invoiceId, setInvoiceId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceId) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      // Tembak API Search Order Backend
      const res = await fetch("http://localhost:3001/api/search-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_id: invoiceId }), // Sesuaikan key JSON sama backend
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Transaksi tidak ditemukan");
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0e14] text-white">
      <Navbar />

      <main className="container mx-auto px-4 py-20 max-w-2xl">
        <h1 className="text-3xl font-bold text-center mb-8 bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
          Lacak Pesanan Kamu
        </h1>

        {/* --- FORM PENCARIAN --- */}
        <div className="bg-gray-800/50 border border-gray-700 p-6 rounded-2xl shadow-xl backdrop-blur-sm mb-8">
          <form onSubmit={handleSearch} className="flex gap-4 flex-col sm:flex-row">
            <input
              type="text"
              placeholder="Masukan Nomor Invoice (Contoh: INV-123456)"
              className="flex-1 bg-gray-900 border border-gray-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500 transition-all"
              value={invoiceId}
              onChange={(e) => setInvoiceId(e.target.value)}
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-8 rounded-xl transition-all disabled:opacity-50"
            >
              {loading ? "Mencari..." : "Cek Status"}
            </button>
          </form>
        </div>

        {/* --- HASIL PENCARIAN (ERROR) --- */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl text-center animate-in fade-in slide-in-from-bottom-4">
            ❌ {error}
          </div>
        )}

        {/* --- HASIL PENCARIAN (SUKSES) --- */}
        {result && (
          <div className="bg-gray-800 border border-gray-700 rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-8">
            {/* Header Status */}
            <div className={`p-4 text-center font-bold text-lg tracking-wider ${
                result.status === "PAID" ? "bg-green-600 text-white" : 
                result.status === "UNPAID" ? "bg-yellow-600 text-white" : 
                "bg-red-600 text-white"
            }`}>
              {result.status === "PAID" ? "TRANSAKSI BERHASIL" : 
               result.status === "UNPAID" ? "MENUNGGU PEMBAYARAN" : "TRANSAKSI GAGAL"}
            </div>

            <div className="p-6 space-y-4">
                {/* Detail Produk */}
                <div className="flex justify-between items-center border-b border-gray-700 pb-4">
                    <div>
                        <p className="text-gray-400 text-xs uppercase">Item</p>
                        <p className="font-bold text-lg">{result.Product?.name || "Nama Item"}</p>
                    </div>
                    <div className="text-right">
                         <p className="text-gray-400 text-xs uppercase">Harga</p>
                         <p className="font-bold text-lg text-green-400">Rp {result.amount.toLocaleString("id-ID")}</p>
                    </div>
                </div>

                {/* Detail Akun */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-gray-400 text-xs uppercase">Invoice</p>
                        <p className="font-mono text-sm">{result.invoice_id}</p>
                    </div>
                    <div>
                        <p className="text-gray-400 text-xs uppercase">Tujuan / ID</p>
                        <p className="font-mono text-sm">{result.customer_phone}</p>
                    </div>
                </div>

                {/* AREA SN / BUKTI (Hanya Muncul kalau PAID) */}
                {result.status === "PAID" && (
                     <div className="bg-green-900/20 border border-green-500/30 p-4 rounded-xl mt-4">
                        <p className="text-green-400 text-xs uppercase font-bold mb-1">Kode SN / Bukti Transaksi</p>
                        <p className="text-white font-mono text-lg break-all select-all">
                            {result.sn || "Sedang memproses..."}
                        </p>
                        <p className="text-gray-500 text-[10px] mt-1">*Simpan kode ini sebagai bukti sah.</p>
                     </div>
                )}
                
                {/* Tombol Bayar (Hanya Muncul kalau UNPAID) */}
                {result.status === "UNPAID" && (
                    <a 
                        href={result.payment_url} 
                        target="_blank"
                        className="block w-full text-center bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-3 rounded-xl mt-4"
                    >
                        Lanjut Pembayaran
                    </a>
                )}

            </div>
          </div>
        )}

      </main>
    </div>
  );
}