"use client";

import { useState, useEffect } from "react";

export default function SettingsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    // 👇 STATE BARU: Cooldown Sync
    const [cooldown, setCooldown] = useState(0);

    // State Setting
    const [formData, setFormData] = useState({
        margin_percent: "5",
        flat_fee: "0"
    });

    // 1. Load Settings & Cek Sisa Cooldown pas Halaman Dibuka
    useEffect(() => {
        fetchSettings();
        checkCooldown();
    }, []);

    // 2. Logic Timer Mundur
    useEffect(() => {
        if (cooldown > 0) {
            const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [cooldown]);

    const checkCooldown = () => {
        const lastSync = localStorage.getItem("last_sync_timestamp");
        if (lastSync) {
            const elapsed = Date.now() - parseInt(lastSync);
            const remaining = 60000 - elapsed; // 60 Detik Cooldown
            if (remaining > 0) {
                setCooldown(Math.ceil(remaining / 1000));
            }
        }
    };

    const getAuthHeaders = () => {
        const token = localStorage.getItem("token");
        return {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        };
    };

    const fetchSettings = async () => {
        try {
            const res = await fetch("http://localhost:3001/api/admin/settings", {
                headers: getAuthHeaders()
            });
            const data = await res.json();
            
            const newSettings = { ...formData };
            if (Array.isArray(data)) {
                data.forEach((item: any) => {
                    if (item.key === "margin_percent") newSettings.margin_percent = item.value;
                    if (item.key === "flat_fee") newSettings.flat_fee = item.value;
                });
            }
            setFormData(newSettings);
        } catch (error) {
            console.error("Gagal load setting", error);
        } finally {
            setLoading(false);
        }
    };

    // 🔥 SIMPAN + AUTO SYNC + COOLDOWN
    const handleSaveAndAutoSync = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if(!formData.margin_percent || !formData.flat_fee) return alert("Isi dulu datanya bos!");

        setSaving(true); 

        try {
            const headers = getAuthHeaders();

            // 1. SIMPAN PENGATURAN KE DB
            const resSave = await fetch("http://localhost:3001/api/admin/settings", {
                method: "PUT",
                headers: headers,
                body: JSON.stringify(formData)
            });

            if (!resSave.ok) throw new Error("Gagal menyimpan setting database");

            // 2. LANGSUNG SYNC PRODUK (AUTO)
            const resSync = await fetch("http://localhost:3001/api/admin/products/sync", {
                method: "POST",
                headers: headers
            });
            
            const dataSync = await resSync.json();

            if (!resSync.ok) throw new Error("Gagal sync harga: " + dataSync.error);

            // 3. SET COOLDOWN (Simpan waktu sekarang ke LocalStorage)
            localStorage.setItem("last_sync_timestamp", Date.now().toString());
            setCooldown(60); // Mulai hitung mundur 60 detik

            // 4. LAPORAN SUKSES
            alert(
                `✅ BERES BOS!\n\n` +
                `1. Pengaturan Margin & Fee Disimpan.\n` +
                `2. Harga ${dataSync.total_processed} Produk Berhasil Diupdate.\n\n` +
                `Tombol akan dikunci selama 60 detik agar server aman.`
            );

        } catch (error: any) {
            console.error(error);
            alert("❌ Terjadi kesalahan: " + error.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-6 w-full max-w-4xl mx-auto min-h-screen pb-40">
            <h1 className="text-3xl font-bold text-white mb-2">⚙️ Pengaturan Toko</h1>
            <p className="text-gray-400 mb-8">Atur keuntungan global dan konfigurasi sistem.</p>

            {loading ? (
                <div className="animate-pulse flex gap-4"><div className="h-10 w-full bg-gray-800 rounded"></div></div>
            ) : (
                <div className="grid gap-8">
                    
                    {/* SETTING KEUNTUNGAN */}
                    <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <span className="text-9xl">💰</span>
                        </div>
                        
                        <h2 className="text-xl font-bold text-green-400 mb-6 flex items-center gap-2">
                            <span>💵</span> Margin & Keuntungan
                        </h2>

                        <form onSubmit={handleSaveAndAutoSync} className="space-y-6 relative z-10">
                            <div className="grid md:grid-cols-2 gap-6">
                                {/* INPUT PERSEN */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-400 mb-2">Margin Persentase (%)</label>
                                    <div className="relative">
                                        <input 
                                            type="number" 
                                            step="0.1"
                                            className="w-full bg-gray-900 border border-gray-600 text-white rounded-xl p-4 pr-12 focus:ring-green-500 focus:border-green-500 outline-none text-lg font-mono font-bold"
                                            value={formData.margin_percent}
                                            onChange={(e) => setFormData({...formData, margin_percent: e.target.value})}
                                        />
                                        <span className="absolute right-4 top-4 text-gray-500 font-bold">%</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">Keuntungan diambil dari persentase harga modal.</p>
                                </div>

                                {/* INPUT FLAT FEE */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-400 mb-2">Biaya Admin Flat (Rp)</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-4 text-gray-500 font-bold">Rp</span>
                                        <input 
                                            type="number" 
                                            className="w-full bg-gray-900 border border-gray-600 text-white rounded-xl p-4 pl-12 focus:ring-green-500 focus:border-green-500 outline-none text-lg font-mono font-bold"
                                            value={formData.flat_fee}
                                            onChange={(e) => setFormData({...formData, flat_fee: e.target.value})}
                                        />
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">Tambahan biaya tetap per transaksi (Opsional).</p>
                                </div>
                            </div>

                            {/* RUMUS PREVIEW */}
                            <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700/50 text-sm text-gray-300 font-mono">
                                <p className="mb-1 text-gray-500 font-bold text-xs uppercase">Simulasi Rumus Harga Jual:</p>
                                <p>Harga Jual = (Modal + <span className="text-green-400">{formData.margin_percent}%</span>) + Rp <span className="text-green-400">{parseInt(formData.flat_fee || "0").toLocaleString()}</span></p>
                            </div>

                            <div className="flex justify-end pt-4 border-t border-gray-700">
                                {/* 👇 TOMBOL SIMPAN DENGAN COOLDOWN & LOADING */}
                                <button 
                                    type="submit" 
                                    disabled={saving || cooldown > 0}
                                    className={`
                                        px-8 py-3 rounded-xl font-bold shadow-lg transition-all flex items-center gap-2
                                        ${saving || cooldown > 0 
                                            ? "bg-gray-700 cursor-not-allowed text-gray-400" 
                                            : "bg-green-600 hover:bg-green-500 hover:scale-105 active:scale-95 text-white shadow-green-500/20"}
                                    `}
                                >
                                    {saving ? (
                                        <>
                                            <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                                            Menyimpan...
                                        </>
                                    ) : cooldown > 0 ? (
                                        <>
                                            <span>⏳</span> Tunggu {cooldown}s...
                                        </>
                                    ) : (
                                        "💾 Simpan & Terapkan Harga"
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>

                </div>
            )}
        </div>
    );
}