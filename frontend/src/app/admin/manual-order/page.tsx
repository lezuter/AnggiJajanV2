"use client";

import { useState, useEffect, useMemo } from "react";
import Lottie from "lottie-react";

// 👇 Pastikan path animasi json bener
import errorAnim from "../../../../public/animations/error.json";
import successAnim from "../../../../public/animations/success.json";

// ==========================================
// TIPE DATA & CONFIG
// ==========================================

interface Product {
  ID: number;
  code: string;
  name: string;
  price: number;
  is_active: boolean;
  catalog?: {
    name: string;
    cardcode?: string;
    slug?: string;
    check_id_code?: string;
  };
}

type InputType = "NUMERIC" | "TEXT" | "ZONE" | "SERVER";

interface GameConfig {
  type: InputType;
  label1: string;
  placeholder1: string;
  label2?: string;
  servers?: { name: string; id: string }[];
  info?: string;
}

const GAME_SCHEMAS: Record<string, GameConfig> = {
  "MOBILE LEGENDS": { type: "ZONE", label1: "User ID", placeholder1: "12345678", label2: "Zone ID", info: "" },
  "RAGNAROK M": { type: "ZONE", label1: "Character ID", placeholder1: "123456", label2: "Zone ID" },
  "POINT BLANK": { type: "ZONE", label1: "User ID", placeholder1: "Garena ID", label2: "Server ID" },
  "GENSHIN IMPACT": { type: "SERVER", label1: "UID", placeholder1: "800...", servers: [{ name: "Asia", id: "001" }, { name: "America", id: "002" }, { name: "Europe", id: "003" }, { name: "TW/HK/MO", id: "004" }] },
  "HONKAI: STAR RAIL": { type: "SERVER", label1: "UID", placeholder1: "800...", servers: [{ name: "Asia", id: "prod_official_asia" }, { name: "America", id: "prod_official_usa" }, { name: "Europe", id: "prod_official_eur" }] },
  "VALORANT": { type: "TEXT", label1: "Riot ID", placeholder1: "Username#Tag123", info: "Wajib format Nama#Tag" },
  "LEAGUE OF LEGENDS": { type: "TEXT", label1: "Riot ID", placeholder1: "Username#Tag" },
  "GROWTOPIA": { type: "TEXT", label1: "GrowID", placeholder1: "Masukan GrowID", info: "Pastikan GrowID & World benar" },
  "DEFAULT": { type: "NUMERIC", label1: "User ID", placeholder1: "Contoh: 12345678" }
};

export default function ManualOrderPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Selection
  const [selectedCatalog, setSelectedCatalog] = useState<string>("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Input State
  const [input1, setInput1] = useState("");
  const [input2, setInput2] = useState("");

  // Check ID State
  const [nickname, setNickname] = useState<string | null>(null);
  const [checkingID, setCheckingID] = useState(false); // Buat loading pas klik proses

  // Modal & Logs
  const [showModal, setShowModal] = useState(false);
  const [modalStep, setModalStep] = useState<'confirm' | 'loading' | 'result'>('confirm');
  const [resultData, setResultData] = useState<{ success: boolean; title: string; desc: string }>({ success: false, title: "", desc: "" });

  const [feedLogs, setFeedLogs] = useState<any[]>([]);

  // 1. Load Logs
  useEffect(() => {
    const savedLogs = localStorage.getItem("manualInjectorLogs");
    if (savedLogs) {
      try { setFeedLogs(JSON.parse(savedLogs)); } catch (e) { console.error("Gagal load history log", e); }
    }
  }, []);

  // 2. Save Logs
  useEffect(() => {
    if (feedLogs.length > 0) { localStorage.setItem("manualInjectorLogs", JSON.stringify(feedLogs)); }
  }, [feedLogs]);

  // Fetch Products
  useEffect(() => {
    const fetchProducts = async () => {
      const token = localStorage.getItem("token");
      try {
        const res = await fetch("http://localhost:3001/api/products", { headers: { "Authorization": `Bearer ${token}` } });
        const data = await res.json();
        if (data.products) {
          setProducts(data.products);
          if (data.products.length > 0 && data.products[0].catalog?.name) {
            setSelectedCatalog(data.products[0].catalog.name);
          }
        }
      } catch (error) { console.error("Error", error); } finally { setLoadingData(false); }
    };
    fetchProducts();
  }, []);

  // Memos
  const catalogs = useMemo(() => {
    const list = new Set(products.map((p) => p.catalog?.name).filter(Boolean));
    return Array.from(list) as string[];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => p.catalog?.name === selectedCatalog);
  }, [products, selectedCatalog]);

  const currentSchema = useMemo(() => {
    if (!selectedCatalog) return GAME_SCHEMAS["DEFAULT"];
    const upperName = selectedCatalog.toUpperCase();
    const foundKey = Object.keys(GAME_SCHEMAS).find(key => upperName.includes(key));
    return foundKey ? GAME_SCHEMAS[foundKey] : GAME_SCHEMAS["DEFAULT"];
  }, [selectedCatalog]);

  const activeCatalogInfo = useMemo(() => {
     const sample = products.find(p => p.catalog?.name === selectedCatalog);
     return sample?.catalog; 
  }, [selectedCatalog, products]);

  // Reset inputs saat ganti katalog
  useEffect(() => {
    setInput1("");
    setInput2("");
    setNickname(null); 
    setSelectedProduct(null);
  }, [selectedCatalog]);

  const getFinalTargetID = () => {
    if (currentSchema.type === "ZONE") return input1 + input2;
    if (currentSchema.type === "SERVER") return input1 + input2;
    return input1;
  };

  // 👇 LOGIC BARU: Handle Klik "Proses Order"
  // Sekalian Cek ID dulu sebelum buka Modal
  const handleInitiate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !input1) return;
    if (currentSchema.type === "ZONE" && !input2) return;
    if (currentSchema.type === "SERVER" && !input2) return;

    // Reset Nickname dulu
    setNickname(null);
    
    // Cek apakah game ini support Cek ID?
    if (activeCatalogInfo?.check_id_code && activeCatalogInfo?.slug) {
        setCheckingID(true); // Nyalain Loading di Tombol
        
        try {
            const res = await fetch("http://localhost:3001/api/check-account", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    slug: activeCatalogInfo.slug,
                    user_id: input1,
                    zone_id: input2
                })
            });
            
            const data = await res.json();
            
            if (data.valid) {
                setNickname(data.nickname); // Kalo ketemu, simpen
            } else {
                setNickname("❌ ID Tidak Ditemukan"); // Kalo gak ketemu, kasih tanda silang
            }
        } catch (err) {
            setNickname("⚠️ Gagal Cek (Server Error)");
        } finally {
            setCheckingID(false); // Matiin Loading
        }
    }

    // Buka Modal Konfirmasi
    setModalStep('confirm');
    setShowModal(true);
  };

  const executeOrder = async () => {
    setModalStep('loading');
    const finalID = getFinalTargetID();

    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:3001/api/admin/manual-order", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ sku: selectedProduct?.code, target_id: finalID })
      });

      const data = await res.json();
      const isSuccess = res.ok && (data.data?.status === "PAID" || data.data?.status === "SUCCESS" || data.data?.status === "PENDING");

      const newLog = {
        invoice: data.data?.ref_id || `INV-${Date.now().toString().slice(-6)}`,
        item: selectedProduct?.name || "Unknown Item",
        target: finalID,
        status: isSuccess ? "SUCCESS" : "FAILED",
        desc: data.message || data.error || "Unknown Error"
      };

      setFeedLogs((prev) => [newLog, ...prev].slice(0, 3));

      if (res.ok) {
        const status = data.data.status;
        if (status === "PAID" || status === "SUCCESS") {
          setResultData({ success: true, title: "TOPUP SUKSES! 🎉", desc: `SN: ${data.data.sn}` });
          setInput1(""); setInput2(""); setSelectedProduct(null); setNickname(null);
        } else if (status === "PENDING") {
          setResultData({ success: true, title: "Order Pending ⏳", desc: `Pesan: ${data.message}` });
        } else {
          setResultData({ success: false, title: "GAGAL PROSES ❌", desc: `Error: ${data.message}` });
        }
      } else {
        setResultData({ success: false, title: "GAGAL CUY! ❌", desc: data.error || data.message || "Error Server" });
      }
    } catch (error) {
      setResultData({ success: false, title: "Error Koneksi ⚠️", desc: "Cek backend lu." });
      setFeedLogs((prev) => [{ invoice: "ERR-CONN", item: selectedProduct?.name, target: finalID, status: "FAILED", desc: "Connection Error" }, ...prev].slice(0, 3));
    } finally {
      setModalStep('result');
    }
  };

  return (
    <div className="p-6 w-full min-h-screen pb-40">
      {/* HEADER SECTION (Sama) */}
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">⚡ Manual Injector</h1>
          <p className="text-gray-400 text-sm mt-1">Mode Dashboard Pro</p>
        </div>
        <div className="flex flex-col items-end space-y-1 pointer-events-none h-[80px] justify-end">
          {feedLogs.length === 0 ? (
            <div className="text-right opacity-30">
              <div className="font-mono text-xs text-gray-500">SYSTEM READY...</div>
            </div>
          ) : (
            feedLogs.map((log, index) => (
              <div key={index} className={`font-mono text-[11px] md:text-xs font-bold transition-all duration-500 animate-in slide-in-from-right-10 fade-in ${log.status === 'SUCCESS' ? "text-green-500 drop-shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]"}`}>
                <div className="flex items-center justify-end gap-2">
                  <span>{log.invoice}</span><span className="text-gray-700">||</span>
                  <span className="max-w-[150px] truncate">{log.item}</span><span className="text-gray-700">||</span>
                  <span>{log.target}</span>
                </div>
                {log.status === 'FAILED' && <div className="text-[10px] text-red-800 text-right pr-1">└ {log.desc}</div>}
              </div>
            ))
          )}
        </div>
      </div>

      {/* KATALOG TABS */}
      <div className="mb-6">
        {!loadingData && (
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {catalogs.map((cat) => (
                  <button key={cat} onClick={() => setSelectedCatalog(cat)} className={`px-5 py-2.5 rounded-lg font-bold text-xs whitespace-nowrap transition-all border ${selectedCatalog === cat ? "bg-white text-black border-white shadow-lg" : "bg-gray-800 text-gray-400 hover:bg-gray-700 border-gray-700"}`}>
                    {cat}
                  </button>
                ))}
              </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row items-start gap-6 relative">
        {/* KOLOM KIRI: PRODUK */}
        <div className="flex-1 w-full min-w-0">
          {loadingData ? (
            <div className="text-center py-20 animate-pulse text-gray-500">Sedang memuat katalog...</div>
          ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredProducts.map((product) => (
                  <div key={product.code} onClick={() => product.is_active && setSelectedProduct(product)} className={`relative p-4 rounded-xl border-2 transition-all duration-200 flex flex-col justify-between h-full text-left min-h-[140px] ${!product.is_active ? "cursor-not-allowed border-red-900/40 bg-red-900/10" : "cursor-pointer hover:border-gray-500 hover:bg-gray-800 custom-cursor-on-hover"} ${selectedProduct?.code === product.code ? "bg-green-900/20 border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.2)] ring-1 ring-green-400" : (!product.is_active ? "" : "bg-gray-900 border-gray-800")}`}>
                    <div className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full animate-pulse z-10 ${product.is_active ? "bg-green-500 shadow-[0_0_10px_#22c55e]" : "bg-red-600 shadow-[0_0_15px_#dc2626] ring-1 ring-red-500"}`}></div>
                    <div className={`flex flex-col h-full ${!product.is_active ? "opacity-50 grayscale" : ""}`}>
                      <div className="text-[10px] text-gray-500 mb-2 font-mono">{product.code}</div>
                      <div className="font-bold text-sm leading-snug mb-3 text-white line-clamp-2">{product.name.replace(product.catalog?.name || "", "").trim()}</div>
                      <div className={`mt-auto font-mono font-bold text-base ${!product.is_active ? "text-gray-500 line-through" : "text-green-400"}`}>Rp {product.price.toLocaleString("id-ID")}</div>
                    </div>
                    {!product.is_active && (<div className="absolute inset-0 flex items-center justify-center pointer-events-none"><span className="bg-red-950/90 text-red-200 text-[10px] font-bold px-2 py-1 rounded border border-red-800/50 -rotate-12 backdrop-blur-sm shadow-lg z-20">GANGGUAN</span></div>)}
                  </div>
                ))}
              </div>
          )}
        </div>

        {/* KOLOM KANAN: CONTROL PANEL */}
        <div className="w-full lg:w-[360px] shrink-0 sticky top-24 z-20">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
            <h2 className="text-sm font-bold text-gray-300 mb-4 flex items-center gap-2 border-b border-gray-700 pb-3"><span>⚡</span> FORMULIR ORDER</h2>

            <div className="space-y-4">
                {/* INPUT 1 */}
                <div>
                <label className="text-[10px] font-bold text-gray-500 mb-1 block uppercase">{currentSchema.label1}</label>
                  <input type="text" placeholder={currentSchema.placeholder1} value={input1} onChange={(e) => setInput1(e.target.value)} className="w-full bg-gray-900 border border-gray-600 text-white font-mono text-sm px-3 py-2.5 rounded-lg focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none transition-all placeholder:text-gray-700"/>
                  {currentSchema.info && <p className="text-[10px] text-yellow-600 mt-1">{currentSchema.info}</p>}
                </div>

                {/* INPUT 2 */}
                {currentSchema.type === "ZONE" && (
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 mb-1 block uppercase">{currentSchema.label2}</label>
                    <input type="text" placeholder="(1234)" value={input2} onChange={(e) => setInput2(e.target.value)} className="w-full bg-gray-900 border border-gray-600 text-white font-mono text-sm px-3 py-2.5 rounded-lg focus:border-green-500 outline-none transition-all placeholder:text-gray-700"/>
                  </div>
                )}
                {currentSchema.type === "SERVER" && currentSchema.servers && (
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 mb-1 block uppercase">Server</label>
                    <select value={input2} onChange={(e) => setInput2(e.target.value)} className="w-full bg-gray-900 border border-gray-600 text-white font-mono text-sm px-3 py-2.5 rounded-lg focus:border-green-500 outline-none cursor-pointer">
                      <option value="">-- Pilih --</option>
                      {currentSchema.servers.map((opt) => (<option key={opt.id} value={opt.id}>{opt.name}</option>))}
                    </select>
                  </div>
                )}

                {/* REVIEW HARGA */}
                <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
                    <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">Total Bayar:</span>
                    <span className={`font-mono font-bold text-base ${selectedProduct ? "text-green-400" : "text-gray-600"}`}>{selectedProduct ? `Rp ${selectedProduct.price.toLocaleString("id-ID")}` : "Rp 0"}</span>
                    </div>
                    {selectedProduct && (<div className="text-[10px] text-gray-500 mt-1 text-right truncate">{selectedProduct.name}</div>)}
                </div>

                {/* TOMBOL PROSES ORDER (Include Cek ID) */}
                <button 
                    onClick={handleInitiate} 
                    disabled={checkingID || !selectedProduct || !input1 || (currentSchema.type === "ZONE" && !input2) || (currentSchema.type === "SERVER" && !input2)} 
                    className={`w-full py-3 rounded-xl font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2 
                        ${!selectedProduct || !input1 ? "bg-gray-700 text-gray-500 cursor-not-allowed border border-gray-600" : "bg-green-600 hover:bg-green-500 text-white border border-green-500 hover:scale-[1.02] active:scale-[0.98]"}
                    `}
                >
                    {checkingID ? (
                        <>
                            <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                            <span>Checking...</span>
                        </>
                    ) : (
                        "🔥 PROSES ORDER"
                    )}
                </button>
              </div>
            </div>
          </div>
        </div>

      {/* POPUP MODAL (Ada Nickname nya Disini) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-gray-800 rounded-2xl border border-gray-700 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
            {modalStep === 'confirm' && (
              <div className="p-6">
                <h3 className="text-xl font-bold text-white mb-4 text-center">Konfirmasi Pesanan</h3>
                <div className="bg-gray-900 rounded-xl p-4 space-y-3 mb-6 border border-gray-700">
                  <div className="flex justify-between"><span className="text-gray-400">Produk</span><span className="text-white font-bold text-right w-1/2">{selectedProduct?.name}</span></div>
                  <div className="flex justify-between items-start">
                    <span className="text-gray-400">Target ID</span>
                    <div className="text-right">
                      <div className="text-yellow-400 font-mono font-bold text-lg">{input1}</div>
                      {currentSchema.type === "ZONE" && <span className="text-gray-500 font-mono text-sm">({input2})</span>}
                      {currentSchema.type === "SERVER" && <div className="text-green-400 text-xs font-bold">{currentSchema.servers?.find(s => s.id === input2)?.name}</div>}
                    </div>
                  </div>
                  
                  {/* 👇 NICKNAME MUNCUL DISINI (AUTO) */}
                  {nickname && (
                      <div className={`flex justify-between items-center border-t border-gray-800 pt-2 mt-2 animate-in fade-in`}>
                        <span className="text-gray-400">Nickname</span>
                        <span className={`font-bold font-mono ${nickname.includes("❌") || nickname.includes("⚠️") ? "text-red-400" : "text-green-400"}`}>{nickname}</span>
                      </div>
                  )}

                  <div className="border-t border-gray-700 pt-2 flex justify-between"><span className="text-gray-400">Total</span><span className="text-green-400 font-bold text-lg">Rp {selectedProduct?.price.toLocaleString("id-ID")}</span></div>
                </div>
                <div className="flex gap-3"><button onClick={() => setShowModal(false)} className="flex-1 py-3 rounded-lg font-bold text-gray-300 hover:bg-gray-700">Batal</button><button onClick={executeOrder} className="flex-1 py-3 rounded-lg font-bold bg-green-600 hover:bg-green-500 text-white">🔥 GAS TEMBAK!</button></div>
              </div>
            )}
            
            {/* LOADING & RESULT TETAP SAMA */}
            {modalStep === 'loading' && (
              <div className="p-10 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-6"></div><h3 className="text-lg font-bold text-white animate-pulse">Memproses...</h3>
              </div>
            )}
            {modalStep === 'result' && (
              <div className="p-6 text-center">
                <div className="flex justify-center mb-6">
                  {resultData.success ? ( <div className="flex justify-center items-center mb-3"><div className="w-72 h-72 drop-shadow-[0_0_20px_rgba(34,197,94,0.8)]"><Lottie animationData={successAnim} loop={true} /></div></div> ) : ( <div className="flex justify-center items-center mb-4"><div className="w-72 h-72 drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]"><Lottie animationData={errorAnim} loop={true} /></div></div> )}
                </div>
                <h3 className={`text-2xl font-bold mb-3 tracking-wide ${resultData.success ? 'text-green-400 drop-shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'text-red-500 drop-shadow-[0_0_10px_rgba(220,38,38,0.8)]'}`}>{resultData.title}</h3>
                <div className={`p-4 rounded-xl mb-8 border ${resultData.success ? 'bg-green-950/30 border-green-500/30 text-green-200' : 'bg-red-950/30 border-red-500/30 text-red-200'}`}><p className="font-mono text-sm break-all leading-relaxed">{resultData.desc}</p></div>
                <button onClick={() => setShowModal(false)} className="w-full py-4 rounded-xl font-bold bg-gray-800 hover:bg-gray-700 text-white border border-gray-600 transition-all hover:scale-[1.02] shadow-lg">Tutup & Transaksi Lagi</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}