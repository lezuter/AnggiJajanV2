"use client";

import { useState, useEffect, useCallback } from "react";
import { useApi } from "@/hooks/useApi"; // 🔥 1. IMPORT SATPAM

interface SettingItem {
  key: string;
  value: string;
}

const isSettingItem = (value: unknown): value is SettingItem => {
  if (typeof value !== "object" || value === null) return false;

  const item = value as Record<string, unknown>;
  return typeof item.key === "string" && typeof item.value === "string";
};

interface PaymentLogoMethod {
  providerMethod: string;
  name: string;
  defaultUrl: string;
}

const PAYMENT_LOGO_SETTING_PREFIX = "payment_logo_midtrans_";

const MIDTRANS_PAYMENT_LOGOS: PaymentLogoMethod[] = [
  {
    providerMethod: "other_qris",
    name: "QRIS",
    defaultUrl: "/payment-logos/qris.svg",
  },
  {
    providerMethod: "gopay",
    name: "GoPay",
    defaultUrl: "/payment-logos/gopay.svg",
  },
  {
    providerMethod: "dana",
    name: "DANA",
    defaultUrl: "/payment-logos/dana.svg",
  },
  { providerMethod: "ovo", name: "OVO", defaultUrl: "/payment-logos/ovo.svg" },
  {
    providerMethod: "shopeepay",
    name: "ShopeePay",
    defaultUrl: "/payment-logos/shopeepay.svg",
  },
  {
    providerMethod: "google_pay",
    name: "Google Pay",
    defaultUrl: "/payment-logos/google-pay.svg",
  },
  {
    providerMethod: "akulaku",
    name: "Akulaku PayLater",
    defaultUrl: "/payment-logos/akulaku.svg",
  },
  {
    providerMethod: "kredivo",
    name: "Kredivo",
    defaultUrl: "/payment-logos/kredivo.svg",
  },
  {
    providerMethod: "bca_va",
    name: "BCA Virtual Account",
    defaultUrl: "/payment-logos/bca.svg",
  },
  {
    providerMethod: "bni_va",
    name: "BNI Virtual Account",
    defaultUrl: "/payment-logos/bni.svg",
  },
  {
    providerMethod: "bri_va",
    name: "BRI Virtual Account",
    defaultUrl: "/payment-logos/bri.svg",
  },
  {
    providerMethod: "cimb_va",
    name: "CIMB Virtual Account",
    defaultUrl: "/payment-logos/cimb.svg",
  },
  {
    providerMethod: "permata_va",
    name: "Permata Virtual Account",
    defaultUrl: "/payment-logos/permata.svg",
  },
  {
    providerMethod: "echannel",
    name: "Mandiri Bill Payment",
    defaultUrl: "/payment-logos/mandiri.svg",
  },
  {
    providerMethod: "bsi_va",
    name: "BSI Virtual Account",
    defaultUrl: "/payment-logos/bsi.svg",
  },
  {
    providerMethod: "seabank_va",
    name: "SeaBank Virtual Account",
    defaultUrl: "/payment-logos/seabank.svg",
  },
  {
    providerMethod: "credit_card",
    name: "Kartu Kredit",
    defaultUrl: "/payment-logos/credit-card.svg",
  },
  {
    providerMethod: "alfamart",
    name: "Alfamart",
    defaultUrl: "/payment-logos/alfamart.svg",
  },
  {
    providerMethod: "indomaret",
    name: "Indomaret",
    defaultUrl: "/payment-logos/indomaret.svg",
  },
];

const paymentLogoSettingKey = (providerMethod: string) =>
  `${PAYMENT_LOGO_SETTING_PREFIX}${providerMethod}`;

const isValidPaymentLogoOverride = (value: string) => {
  const normalized = value.trim();
  if (!normalized) return true;

  if (normalized.startsWith("/")) {
    return (
      !normalized.startsWith("//") &&
      !normalized.includes("\\") &&
      !normalized.includes("..")
    );
  }

  try {
    const parsed = new URL(normalized);
    return parsed.protocol === "https:" && Boolean(parsed.hostname);
  } catch {
    return false;
  }
};

const handlePaymentLogoImageError = (
  event: React.SyntheticEvent<HTMLImageElement>,
  defaultUrl: string,
) => {
  const image = event.currentTarget;

  if (image.dataset.fallbackApplied === "true") {
    image.style.display = "none";
    return;
  }

  image.dataset.fallbackApplied = "true";
  image.src = defaultUrl;
};

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
  const [savingPaymentLogos, setSavingPaymentLogos] = useState(false);
  const [paymentLogos, setPaymentLogos] = useState<Record<string, string>>({});

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
        const data: unknown = await res.json();

        if (Array.isArray(data)) {
          const settingItems = data.filter(isSettingItem);

          setFormData((current) => {
            const newSettings = { ...current };

            settingItems.forEach((item) => {
              if (item.key === "margin_percent")
                newSettings.margin_percent = item.value;
              if (item.key === "flat_fee") newSettings.flat_fee = item.value;
            });

            return newSettings;
          });

          setPaymentLogos(() => {
            const logoSettings: Record<string, string> = {};

            settingItems.forEach((item) => {
              if (!item.key.startsWith(PAYMENT_LOGO_SETTING_PREFIX)) return;

              const providerMethod = item.key.slice(
                PAYMENT_LOGO_SETTING_PREFIX.length,
              );
              logoSettings[providerMethod] = item.value;
            });

            return logoSettings;
          });
        }
      }
    } catch (error) {
      console.error("Gagal load setting", error);
    } finally {
      setLoading(false);
    }
  }, [get]);

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

  const handleSavePaymentLogos = async (e: React.FormEvent) => {
    e.preventDefault();

    const invalidMethod = MIDTRANS_PAYMENT_LOGOS.find((method) => {
      const value = paymentLogos[method.providerMethod] || "";
      return !isValidPaymentLogoOverride(value);
    });
    if (invalidMethod) {
      alert(`${invalidMethod.name}: gunakan path lokal /... atau URL https://`);
      return;
    }

    setSavingPaymentLogos(true);

    try {
      const payload = Object.fromEntries(
        MIDTRANS_PAYMENT_LOGOS.map((method) => [
          paymentLogoSettingKey(method.providerMethod),
          (paymentLogos[method.providerMethod] || "").trim(),
        ]),
      );

      const response = await put("/admin/settings", payload);
      if (!response.ok) {
        throw new Error("Gagal menyimpan override logo pembayaran");
      }

      alert("Logo metode pembayaran berhasil disimpan.");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Kesalahan tidak diketahui";
      alert(`Gagal menyimpan logo: ${message}`);
    } finally {
      setSavingPaymentLogos(false);
    }
  };

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
    } catch (error: unknown) {
      console.error(error);
      const message =
        error instanceof Error ? error.message : "Kesalahan tidak diketahui";
      alert("❌ Terjadi kesalahan: " + message);
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

          {/* PAYMENT LOGO ADMIN CARD */}
          <CardBase className="mt-8 p-8">
            <div className="flex flex-col gap-3 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-widest text-white">
                  Logo metode pembayaran
                </h2>
                <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-400">
                  Kosongkan override untuk memakai badge lokal bawaan. Isi URL
                  atau path aset untuk mengganti logo metode tertentu.
                </p>
              </div>
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-sky-300/60">
                Midtrans · Hybrid
              </span>
            </div>

            <form onSubmit={handleSavePaymentLogos} className="mt-6">
              <div className="grid gap-4 lg:grid-cols-2">
                {MIDTRANS_PAYMENT_LOGOS.map((method) => {
                  const overrideValue =
                    paymentLogos[method.providerMethod] || "";
                  const previewUrl = overrideValue.trim() || method.defaultUrl;

                  return (
                    <div
                      key={method.providerMethod}
                      className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4"
                    >
                      <div className="flex items-center gap-4">
                        <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            key={`glow-${previewUrl}`}
                            src={previewUrl}
                            alt=""
                            aria-hidden="true"
                            onError={(event) =>
                              handlePaymentLogoImageError(
                                event,
                                method.defaultUrl,
                              )
                            }
                            className="pointer-events-none absolute h-12 w-12 scale-125 object-contain opacity-30 blur-[9px]"
                          />
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            key={`main-${previewUrl}`}
                            src={previewUrl}
                            alt={`${method.name} preview`}
                            onError={(event) =>
                              handlePaymentLogoImageError(
                                event,
                                method.defaultUrl,
                              )
                            }
                            className="relative z-10 h-12 w-12 object-contain"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-white">
                            {method.name}
                          </p>
                          <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.08em] text-slate-500">
                            midtrans:{method.providerMethod}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setPaymentLogos((current) => ({
                              ...current,
                              [method.providerMethod]: "",
                            }))
                          }
                          className="rounded-lg border border-white/[0.08] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 transition hover:border-white/[0.16] hover:text-white"
                        >
                          Default
                        </button>
                      </div>

                      <input
                        type="text"
                        value={overrideValue}
                        onChange={(event) =>
                          setPaymentLogos((current) => ({
                            ...current,
                            [method.providerMethod]: event.target.value,
                          }))
                        }
                        placeholder={method.defaultUrl}
                        className="mt-4 w-full rounded-xl border border-white/[0.06] bg-black/20 px-4 py-3 font-mono text-[11px] text-sky-200 outline-none transition placeholder:text-slate-600 focus:border-sky-400/40 focus:bg-white/[0.035]"
                      />
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 flex justify-end border-t border-white/[0.05] pt-6">
                <button
                  type="submit"
                  disabled={savingPaymentLogos}
                  className={`rounded-xl border px-6 py-3 text-xs font-bold uppercase tracking-widest transition ${
                    savingPaymentLogos
                      ? "cursor-not-allowed border-white/[0.05] bg-white/[0.02] text-slate-500"
                      : "border-sky-400/30 bg-sky-400/10 text-sky-200 hover:border-sky-300/50 hover:bg-sky-400/15"
                  }`}
                >
                  {savingPaymentLogos
                    ? "Menyimpan logo..."
                    : "Simpan logo pembayaran"}
                </button>
              </div>
            </form>
          </CardBase>
        </div>
      )}
    </div>
  );
}
