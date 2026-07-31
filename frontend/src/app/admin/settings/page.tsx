"use client";

import { useState, useEffect, useCallback } from "react";
import { useApi } from "@/hooks/useApi"; // 🔥 1. IMPORT SATPAM

// ✨ PREMIUM GLASSMORPHISM COMPONENT ✨
const CardBase = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={`relative overflow-hidden bg-gradient-to-br from-white/[0] to-transparent backdrop-blur-[100px] backdrop-saturate-[200%] border border-white/[0.04] shadow-[0_8px_32px_0_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(255,255,255,0.02)] rounded-[28px] ${className}`}
  >
    <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.15] to-transparent opacity-40" />
    <div className="relative z-10">{children}</div>
  </div>
);

export default function SettingsPage() {
  // 🔥 2. PANGGIL METHOD DARI USEAPI
  const { get, put, post } = useApi();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // State Cooldown Sync
  const [cooldown, setCooldown] = useState(0);

  // State Setting
  const [formData, setFormData] = useState({
    margin_percent: "5",
    flat_fee: "0",
  });

  // Cek Cooldown
  const checkCooldown = useCallback(() => {
    const lastSync = localStorage.getItem("last_sync_timestamp");
    if (lastSync) {
      const elapsed = Date.now() - parseInt(lastSync);
      const remaining = 60000 - elapsed; // 60 Detik Cooldown
      if (remaining > 0) {
        setCooldown(Math.ceil(remaining / 1000));
      }
    }
  }, []);

  // 🔥 3. FETCH SETTINGS BERSIH
  const fetchSettings = useCallback(async () => {
    try {
      const res = await get("/admin/settings");
      if (res.ok) {
        const data = await res.json();

        const newSettings = { ...formData };
        if (Array.isArray(data)) {
          data.forEach((item: any) => {
            if (item.key === "margin_percent")
              newSettings.margin_percent = item.value;
            if (item.key === "flat_fee") newSettings.flat_fee = item.value;
          });
        }
        setFormData(newSettings);
      }
    } catch (error) {
      console.error("Gagal load setting", error);
    } finally {
      setLoading(false);
    }
  }, [get]); // Dependensi form data aman karena kita cuma override key-nya

  // Load Awal
  useEffect(() => {
    fetchSettings();
    checkCooldown();
  }, [fetchSettings, checkCooldown]);

  // Timer Mundur
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  // 🔥 4. SAVE & SYNC BERSIH
  const handleSaveAndAutoSync = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.margin_percent || !formData.flat_fee)
      return alert("Isi dulu datanya bos!");

    setSaving(true);

    try {
      // 1. SIMPAN PENGATURAN PAKE PUT()
      const resSave = await put("/admin/settings", formData);
      if (!resSave.ok) throw new Error("Gagal menyimpan setting database");

      // 2. LANGSUNG SYNC PRODUK PAKE POST() (Body kosong {})
      const resSync = await post("/admin/products/sync", {});
      const dataSync = await resSync.json();

      if (!resSync.ok)
        throw new Error(
          "Gagal sync harga: " + (dataSync.error || "Unknown Error"),
        );

      // 3. SET COOLDOWN
      localStorage.setItem("last_sync_timestamp", Date.now().toString());
      setCooldown(60);

      // 4. LAPORAN SUKSES
      alert(
        `✅ BERES BOS!\n\n` +
          `1. Pengaturan Margin & Fee Disimpan.\n` +
          `2. Harga ${dataSync.total_processed || "semua"} Produk Berhasil Diupdate.\n\n` +
          `Tombol akan dikunci selama 60 detik agar server aman.`,
      );
    } catch (error: any) {
      console.error(error);
      alert("❌ Terjadi kesalahan: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-[1920px] mx-auto pb-10">
      {/* HEADER SECTION */}
      <div className="mb-10 flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3 uppercase tracking-tight">
            <span className="w-2 h-8 bg-gradient-to-b from-emerald-400 to-green-600 rounded-full"></span>
            System Settings
          </h1>
          <p className="text-emerald-300/70 text-sm mt-1 ml-5 tracking-widest uppercase text-[10px] font-bold">
            Atur keuntungan global & konfigurasi server
          </p>
        </div>
      </div>

      {loading ? (
        <div className="animate-pulse flex gap-4">
          <div className="h-32 w-full max-w-4xl bg-white/[0.02] border border-white/[0.05] rounded-[28px]"></div>
        </div>
      ) : (
        <div className="w-full max-w-4xl">
          {/* SETTING KEUNTUNGAN CARD */}
          <CardBase className="p-8 group relative overflow-hidden">
            {/* Background Ornament */}
            <div className="absolute -top-20 -right-20 text-[200px] opacity-[0.03] group-hover:scale-110 group-hover:-rotate-12 transition-transform duration-700 pointer-events-none">
              💰
            </div>

            <h2 className="text-sm font-bold text-white mb-8 border-b border-white/10 pb-4 uppercase tracking-widest flex items-center gap-3">
              <span className="w-2 h-4 bg-emerald-400 rounded-full shadow-[0_0_10px_rgba(52,211,153,0.5)]"></span>
              Margin & Keuntungan
            </h2>

            <form
              onSubmit={handleSaveAndAutoSync}
              className="space-y-8 relative z-10"
            >
              <div className="grid md:grid-cols-2 gap-8">
                {/* INPUT PERSEN */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest">
                    Margin Persentase (%)
                  </label>
                  <div className="relative group/input">
                    <input
                      type="number"
                      step="0.1"
                      className="w-full bg-white/[0.02] border border-white/[0.05] text-emerald-400 rounded-xl p-4 pr-12 focus:border-emerald-500/50 focus:bg-white/[0.05] focus:shadow-[0_0_15px_rgba(52,211,153,0.15)] outline-none text-2xl font-mono font-bold transition-all"
                      value={formData.margin_percent}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          margin_percent: e.target.value,
                        })
                      }
                    />
                    <span className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 font-bold group-focus-within/input:text-emerald-500/50 transition-colors">
                      %
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2 font-mono">
                    Keuntungan diambil dari persentase harga modal.
                  </p>
                </div>

                {/* INPUT FLAT FEE */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest">
                    Biaya Admin Flat (Rp)
                  </label>
                  <div className="relative group/input">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 font-bold group-focus-within/input:text-emerald-500/50 transition-colors">
                      Rp
                    </span>
                    <input
                      type="number"
                      className="w-full bg-white/[0.02] border border-white/[0.05] text-emerald-400 rounded-xl p-4 pl-14 focus:border-emerald-500/50 focus:bg-white/[0.05] focus:shadow-[0_0_15px_rgba(52,211,153,0.15)] outline-none text-2xl font-mono font-bold transition-all"
                      value={formData.flat_fee}
                      onChange={(e) =>
                        setFormData({ ...formData, flat_fee: e.target.value })
                      }
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2 font-mono">
                    Tambahan biaya tetap per transaksi (Opsional).
                  </p>
                </div>
              </div>

              {/* RUMUS PREVIEW GLASS */}
              <div className="bg-sky-500/[0.02] p-5 rounded-xl border border-sky-500/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)]">
                <p className="mb-2 text-sky-400/80 font-bold text-[10px] uppercase tracking-widest">
                  Simulasi Rumus Harga Jual Akhir:
                </p>
                <div className="text-sm text-slate-300 font-mono tracking-wide">
                  Harga Jual = (Modal +{" "}
                  <span className="text-emerald-400 font-bold">
                    {formData.margin_percent}%
                  </span>
                  ) + Rp{" "}
                  <span className="text-emerald-400 font-bold">
                    {parseInt(formData.flat_fee || "0").toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="flex justify-end pt-6 border-t border-white/[0.05]">
                {/* 👇 TOMBOL SIMPAN DENGAN COOLDOWN & LOADING */}
                <button
                  type="submit"
                  disabled={saving || cooldown > 0}
                  className={`
                                        px-8 py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest border transition-all duration-300 shadow-[inset_0_1px_2px_rgba(255,255,255,0.2)] flex items-center gap-3
                                        ${
                                          saving || cooldown > 0
                                            ? "bg-white/[0.02] text-slate-500 border-white/[0.05] cursor-not-allowed"
                                            : "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/30 hover:border-emerald-500/50 hover:shadow-[0_0_20px_rgba(52,211,153,0.3)]"
                                        }
                                    `}
                >
                  {saving ? (
                    <>
                      <span className="animate-spin w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full"></span>
                      <span>Processing...</span>
                    </>
                  ) : cooldown > 0 ? (
                    <>
                      <span className="text-sm">⏳</span>
                      <span>Cooldown {cooldown}s</span>
                    </>
                  ) : (
                    <>
                      <span className="text-sm">💾</span>
                      <span>Simpan & Sync Harga</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </CardBase>
        </div>
      )}
    </div>
  );
}
