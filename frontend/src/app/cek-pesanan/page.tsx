"use client";

import { FormEvent, useMemo, useState } from "react";
import Navbar from "@/components/Navbar";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api"
).replace(/\/+$/, "");

interface SearchOrderResult {
  invoice_id: string;
  product?: { name?: string };
  Product?: { name?: string };
  product_name?: string;
  target?: string;
  amount?: number;
  status?: string;
  payment_status?: string;
  fulfillment_status?: string;
  provider_status?: string;
  sn?: string;
  serial_number?: string;
  error_message?: string;
  created_at?: string;
  updated_at?: string;
}

const formatIDR = (value?: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(value || 0);

const getStatusView = (order: SearchOrderResult | null) => {
  const payment = (order?.payment_status || order?.status || "").toUpperCase();
  const fulfillment = (order?.fulfillment_status || "").toUpperCase();

  if (payment === "EXPIRED") {
    return {
      label: "Pembayaran Kedaluwarsa",
      description:
        "Invoice pembayaran sudah tidak berlaku. Silakan buat pesanan baru jika masih ingin melanjutkan.",
      className: "border-yellow-400/25 bg-yellow-500/10 text-yellow-100"
    };
  }

  if (payment === "FAILED" && fulfillment !== "FAILED") {
    return {
      label: "Pembayaran Gagal",
      description:
        "Pembayaran tidak berhasil diproses. Silakan buat pesanan baru atau hubungi admin.",
      className: "border-red-400/25 bg-red-500/10 text-red-100"
    };
  }

  if (payment === "UNPAID" && (!fulfillment || fulfillment === "WAITING_PAYMENT")) {
    return {
      label: "Menunggu Pembayaran",
      description:
        "Pesanan sudah dibuat dan sedang menunggu pembayaran dari customer.",
      className: "border-yellow-400/25 bg-yellow-500/10 text-yellow-100"
    };
  }

  if (payment === "PAID" && fulfillment === "READY") {
    return {
      label: "Pembayaran Berhasil, Siap Diproses",
      description:
        "Pembayaran sudah diterima dan transaksi sedang menunggu eksekusi sistem.",
      className: "border-sky-400/25 bg-sky-500/10 text-sky-100"
    };
  }

  if (payment === "PAID" && fulfillment === "PROCESSING") {
    return {
      label: "Top Up Sedang Diproses",
      description:
        "Transaksi sedang diproses oleh provider. Silakan cek lagi beberapa saat.",
      className: "border-sky-400/25 bg-sky-500/10 text-sky-100"
    };
  }

  if (payment === "PAID" && fulfillment === "SUCCESS") {
    return {
      label: "Transaksi Berhasil",
      description: "Top up berhasil diproses.",
      className: "border-emerald-400/25 bg-emerald-500/10 text-emerald-100"
    };
  }

  if (payment === "PAID" && fulfillment === "FAILED") {
    return {
      label: "Top Up Gagal",
      description:
        "Top up belum berhasil diproses. Hubungi admin dengan nomor invoice ini.",
      className: "border-red-400/25 bg-red-500/10 text-red-100"
    };
  }

  return {
    label: order?.status || "Status Pesanan",
    description: "Status pesanan sudah diterima sistem.",
    className: "border-white/10 bg-white/[0.04] text-slate-100"
  };
};

export default function CekPesananPage() {
  const [invoiceId, setInvoiceId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchOrderResult | null>(null);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const statusView = useMemo(() => getStatusView(result), [result]);
  const productName =
    result?.product?.name ||
    result?.Product?.name ||
    result?.product_name ||
    "Nama Item";
  const target = result?.target || "-";
  const serialNumber = result?.sn || result?.serial_number || "";

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!invoiceId.trim()) return;

    setLoading(true);
    setError("");
    setResult(null);
    setHasSearched(true);

    try {
      const res = await fetch(`${API_BASE_URL}/search-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_id: invoiceId.trim() })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Transaksi tidak ditemukan");
      }

      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Pesanan belum ditemukan. Periksa invoice lalu coba lagi."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07091f] text-white">
      <Navbar />

      <main className="mx-auto max-w-3xl px-6 pb-20 pt-32">
        <div className="mb-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-sky-300">
            Cek Pesanan
          </p>
          <h1 className="mt-3 text-3xl font-black text-white md:text-5xl">
            Lacak Status Top Up
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-400">
            Masukkan nomor invoice untuk melihat status pembayaran dan proses
            top up kamu.
          </p>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-2xl backdrop-blur-xl">
          <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              placeholder="Contoh: INV-123456"
              className="flex-1 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/50"
              value={invoiceId}
              onChange={e => setInvoiceId(e.target.value)}
            />
            <button
              type="submit"
              disabled={loading || !invoiceId.trim()}
              className="rounded-2xl border border-sky-400/30 bg-sky-500/20 px-6 py-3 text-sm font-black text-sky-100 transition hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Mencari..." : "Cek Status"}
            </button>
          </form>
        </div>

        {error && (
          <div className="mt-6 rounded-3xl border border-red-400/25 bg-red-500/10 p-5 text-center text-sm font-bold text-red-100">
            {error}
          </div>
        )}

        {!loading && !error && hasSearched && !result && (
          <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center text-sm text-slate-400">
            Belum ada hasil. Pastikan invoice yang kamu masukkan sudah benar.
          </div>
        )}

        {result && (
          <div className="mt-6 overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] shadow-2xl">
            <div className={`border-b p-5 text-center ${statusView.className}`}>
              <div className="text-lg font-black">{statusView.label}</div>
              <p className="mx-auto mt-2 max-w-xl text-xs leading-6 opacity-80">
                {statusView.description}
              </p>
            </div>

            <div className="space-y-5 p-6">
              <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
                <div>
                  <p className="text-xs uppercase text-slate-500">Item</p>
                  <p className="mt-1 text-lg font-black text-white">
                    {productName}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase text-slate-500">Nominal</p>
                  <p className="mt-1 font-mono text-lg font-black text-emerald-300">
                    {formatIDR(result.amount)}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase text-slate-500">Invoice</p>
                  <p className="mt-1 break-all font-mono text-sm text-slate-100">
                    {result.invoice_id}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500">Tujuan / ID</p>
                  <p className="mt-1 break-all font-mono text-sm text-slate-100">
                    {target}
                  </p>
                </div>
              </div>

              {result.payment_status === "PAID" &&
                result.fulfillment_status === "SUCCESS" && (
                  <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
                    <p className="text-xs font-bold uppercase text-emerald-300">
                      Kode SN / Bukti Transaksi
                    </p>
                    <p className="mt-2 break-all font-mono text-sm font-black text-white">
                      {serialNumber || "SN sedang disiapkan sistem."}
                    </p>
                  </div>
                )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
