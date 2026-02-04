"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: any; // Data dari Tripay (merchant_ref, qr_url, amount)
}

export default function PaymentModal({ isOpen, onClose, data }: PaymentModalProps) {
  const router = useRouter();
  const [status, setStatus] = useState("UNPAID"); // UNPAID | PAID | FAILED
  const [sn, setSn] = useState("");

  // Reset status kalau modal dibuka baru
  useEffect(() => {
    if (isOpen) {
        setStatus("UNPAID");
        setSn("");
    }
  }, [isOpen]);

  // 🔥 LOGIC POLLING (Nanya Status Tiap 3 Detik)
  useEffect(() => {
    if (!isOpen || !data || status === "PAID" || status === "FAILED") return;

    const interval = setInterval(async () => {
      try {
        // Pake merchant_ref (INV-XXX) buat nanya ke backend
        const res = await fetch(`http://localhost:3001/api/transaction/${data.merchant_ref}`);
        const result = await res.json();

        console.log("Status Check:", result.status);

        if (result.status === "PAID") {
          setStatus("PAID");
          setSn(result.sn);
          clearInterval(interval); // Stop nanya kalau udah lunas
        } else if (result.status === "FAILED" || result.status === "EXPIRED") {
          setStatus("FAILED");
          clearInterval(interval);
        }
      } catch (error) {
        console.error("Gagal cek status:", error);
      }
    }, 3000); // Cek tiap 3000ms (3 detik)

    return () => clearInterval(interval); // Bersihin timer pas close
  }, [isOpen, data, status]);


  if (!isOpen || !data) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-gray-800 border border-gray-700 w-full max-w-md rounded-3xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-200 text-center">
        
        {/* Tombol Close */}
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          ✕
        </button>

        {/* --- TAMPILAN 1: MENUNGGU PEMBAYARAN (UNPAID) --- */}
        {status === "UNPAID" && (
            <>
                <h3 className="text-xl font-bold text-white mb-1">Menunggu Pembayaran</h3>
                <p className="text-sm text-gray-400 mb-6">Scan QRIS di bawah ini.</p>

                <div className="bg-gray-900/50 rounded-xl p-4 mb-6 border border-gray-700 border-dashed">
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Total Tagihan</p>
                    <p className="text-3xl font-bold text-green-400">
                        Rp {data.amount ? data.amount.toLocaleString("id-ID") : "0"}
                    </p>
                    <p className="text-xs text-gray-500 mt-2 font-mono">{data.merchant_ref}</p>
                </div>

                <div className="bg-white p-4 rounded-2xl inline-block mb-6">
                    {data.qr_url ? (
                        <Image 
                            src={data.qr_url} 
                            alt="QRIS Code" 
                            width={200} 
                            height={200} 
                            className="mx-auto"
                            unoptimized
                        />
                    ) : (
                        <div className="w-48 h-48 flex items-center justify-center text-black">
                             Loading QR...
                        </div>
                    )}
                </div>
                <p className="text-xs text-gray-500 mb-4 animate-pulse">
                    Mengecek pembayaran otomatis...
                </p>
            </>
        )}

        {/* --- TAMPILAN 2: SUKSES (PAID) --- */}
        {status === "PAID" && (
            <div className="py-8">
                <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(34,197,94,0.5)]">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Pembayaran Berhasil!</h3>
                <p className="text-gray-400 mb-6">Top up kamu sedang diproses sistem.</p>
                
                {sn && (
                    <div className="bg-green-900/30 border border-green-500/30 p-3 rounded-lg mb-6">
                        <p className="text-xs text-green-400">SN / Bukti:</p>
                        <p className="text-sm text-white font-mono break-all">{sn}</p>
                    </div>
                )}

                <button 
                    onClick={() => { onClose(); router.push('/ceksn'); }} // Bisa arahkan ke halaman riwayat
                    className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-8 rounded-xl w-full"
                >
                    Tutup & Cek Riwayat
                </button>
            </div>
        )}

        {/* --- TAMPILAN 3: GAGAL (FAILED) --- */}
        {status === "FAILED" && (
             <div className="py-8">
                <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(239,68,68,0.5)]">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Transaksi Gagal</h3>
                <p className="text-gray-400 mb-6">Pembayaran kadaluarsa atau dibatalkan.</p>
                
                <button 
                    onClick={onClose}
                    className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-8 rounded-xl w-full"
                >
                    Tutup
                </button>
            </div>
        )}

      </div>
    </div>
  );
}