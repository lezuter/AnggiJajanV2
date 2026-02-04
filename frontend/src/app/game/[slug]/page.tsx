"use client";

import Navbar from "@/components/Navbar";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import PaymentModal from "@/components/PaymentModal";

// Interface Data
interface Product {
    ID: number;
    name: string;
    code: string;
    price: number;
    stock: number;
}

interface Catalog {
    ID: number;
    name: string;
    slug: string;
    image_url: string;
    category: string;
    products: Product[]; // 👈 UPDATE: Ubah jadi huruf kecil 'products' (sesuai JSON dari Go)
}

export default function GameDetailPage() {
    const params = useParams();
    const router = useRouter();
    const slug = params.slug as string;

    const [game, setGame] = useState<Catalog | null>(null);
    const [loading, setLoading] = useState(true);

    // Form State
    const [userId, setUserId] = useState("");
    const [zoneId, setZoneId] = useState("");
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [paymentMethod, setPaymentMethod] = useState("QRIS");
    const [isProcessing, setIsProcessing] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [transactionData, setTransactionData] = useState<any>(null);

    // 1. AMBIL DATA GAME
    useEffect(() => {
        const fetchGameData = async () => {
            try {
                // Debugging: Liat URL yang dipanggil bener gak
                console.log("Fetching:", `http://localhost:3001/api/catalogs/${slug}`);

                const res = await fetch(`http://localhost:3001/api/catalogs/${slug}`);

                if (!res.ok) {
                    // Kalau 404/500, kita throw error biar masuk catch
                    throw new Error(`Error: ${res.status}`);
                }

                const data = await res.json();
                console.log("Data Game:", data); // 👈 Cek di Console Browser: Ada isinya gak?
                setGame(data);
            } catch (error) {
                console.error("Gagal load game:", error);
            } finally {
                setLoading(false);
            }
        };
        if (slug) fetchGameData();
    }, [slug]);

    // 2. LOGIC CHECKOUT
    const handleCheckout = async () => {
        if (!userId || !selectedProduct) {
            alert("Mohon lengkapi ID Player dan Pilih Nominal!");
            return;
        }

        setIsProcessing(true);
        try {
            const fullUserId = zoneId ? `${userId} (${zoneId})` : userId;

            const res = await fetch("http://localhost:3001/api/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    product_id: selectedProduct.ID,
                    customer_phone: fullUserId,
                    payment_method: paymentMethod
                })
            });

            const result = await res.json();

            if (res.ok) {
                // 👇 LOGIC BARU: Buka Modal, jangan redirect
                // Tripay biasanya nyimpen data detail di result.data
                // Tapi cek struktur JSON backend lu. Kalau backend lu ngirim:
                // { data: { ...tripay_response... } } maka pake result.data
                // Kalau backend lu langsung { ...tripay_response... }, pake result.

                setTransactionData(result.data || result);
                setShowModal(true);

            } else {
                alert("Gagal: " + result.error);
            }
        } catch (err) {
            alert("Terjadi kesalahan sistem.");
        } finally {
            setIsProcessing(false);
        }
    };

    // --- LOADING ---
    if (loading) return (
        <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center">
            <div className="animate-spin text-4xl">🎮</div>
        </div>
    );

    // --- 404 NOT FOUND ---
    if (!game) return (
        <div className="min-h-screen bg-[#0b0f19] flex flex-col items-center justify-center text-white">
            <h1 className="text-4xl font-bold mb-4">404</h1>
            <p className="text-gray-400">Game tidak ditemukan.</p>
            <p className="text-xs text-gray-600 mt-2">Slug: {slug}</p>
            <button onClick={() => router.push("/")} className="mt-6 bg-green-600 px-6 py-2 rounded-xl font-bold">Kembali ke Home</button>
        </div>
    );

    return (
        <main className="min-h-screen bg-[#0b0f19] pb-20 text-white">
            <Navbar />

            {/* HEADER GAMBAR */}
            <div className="relative h-64 md:h-80 w-full overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-[#0b0f19] via-[#0b0f19]/80 to-transparent z-10" />
                <img src={game.image_url} alt={game.name} className="w-full h-full object-cover blur-sm opacity-50" />
            </div>

            <div className="max-w-6xl mx-auto px-4 -mt-32 relative z-20">

                {/* INFO GAME */}
                <div className="flex items-end gap-6 mb-8">
                    <div className="w-28 h-28 md:w-40 md:h-40 bg-gray-800 rounded-3xl p-1 shadow-2xl border-4 border-gray-800">
                        <img src={game.image_url} alt={game.name} className="w-full h-full object-cover rounded-2xl" />
                    </div>
                    <div className="mb-2">
                        <h1 className="text-2xl md:text-4xl font-bold text-white drop-shadow-md">{game.name}</h1>
                        <p className="text-green-400 font-medium text-sm md:text-base">Proses Otomatis</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="md:col-span-2 space-y-6">

                        {/* 1. INPUT ID */}
                        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
                            <div className="flex items-center gap-3 mb-4 border-b border-gray-700 pb-4">
                                <span className="bg-green-600 w-8 h-8 flex items-center justify-center rounded-full font-bold">1</span>
                                <h3 className="font-bold text-lg">Masukan ID</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <input
                                    type="text"
                                    placeholder="User ID"
                                    className="bg-gray-900 border-gray-600 border rounded-xl px-4 py-3 w-full text-white"
                                    value={userId}
                                    onChange={(e) => setUserId(e.target.value)}
                                />

                                {/* 👇 UPDATE BAGIAN INI: Cek apakah slug mengandung 'mobile-legends' */}
                                {game.slug.toLowerCase().includes("mobile-legends") && (
                                    <input
                                        type="text"
                                        placeholder="(Zone ID)"
                                        className="bg-gray-900 border-gray-600 border rounded-xl px-4 py-3 w-full text-white"
                                        value={zoneId}
                                        onChange={(e) => setZoneId(e.target.value)}
                                    />
                                )}
                            </div>
                        </div>

                        {/* 2. PILIH ITEM (NOMINAL) */}
                        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
                            <div className="flex items-center gap-3 mb-4 border-b border-gray-700 pb-4">
                                <span className="bg-green-600 w-8 h-8 flex items-center justify-center rounded-full font-bold">2</span>
                                <h3 className="font-bold text-lg">Pilih Nominal</h3>
                            </div>

                            {/* 👇 PERHATIKAN: Pake (game.products || []) dan huruf kecil 'products' */}
                            {(game.products || []).length === 0 ? (
                                <p className="text-gray-500 text-center">Belum ada produk.</p>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {(game.products || []).map((product) => (
                                        <button
                                            key={product.ID}
                                            onClick={() => setSelectedProduct(product)}
                                            className={`relative p-4 rounded-xl text-left border transition-all ${selectedProduct?.ID === product.ID
                                                ? "bg-green-900/20 border-green-500 ring-1 ring-green-500"
                                                : "bg-gray-900 border-gray-700 hover:bg-gray-700"
                                                }`}
                                        >
                                            <p className="font-bold text-sm text-white">{product.name}</p>
                                            <p className="text-green-400 text-sm">Rp {product.price.toLocaleString("id-ID")}</p>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* 3. PEMBAYARAN */}
                        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
                            <div className="flex items-center gap-3 mb-4 border-b border-gray-700 pb-4">
                                <span className="bg-green-600 w-8 h-8 flex items-center justify-center rounded-full font-bold">3</span>
                                <h3 className="font-bold text-lg">Pembayaran</h3>
                            </div>
                            <label className={`flex items-center justify-between p-4 rounded-xl cursor-pointer border ${paymentMethod === "QRIS" ? "bg-white text-black border-green-500" : "bg-gray-900 border-gray-700"}`}>
                                <div className="flex items-center gap-3">
                                    <input type="radio" checked={paymentMethod === "QRIS"} onChange={() => setPaymentMethod("QRIS")} className="accent-green-600 w-5 h-5" />
                                    <span className="font-bold">QRIS (All Payment)</span>
                                </div>
                                <span className="font-bold">{selectedProduct ? `Rp ${selectedProduct.price.toLocaleString("id-ID")}` : "-"}</span>
                            </label>
                        </div>
                    </div>

                    {/* CHECKOUT CARD */}
                    <div className="md:col-span-1">
                        <div className="sticky top-24 bg-gray-800 border border-gray-700 rounded-2xl p-6 shadow-xl">
                            <button
                                onClick={handleCheckout}
                                disabled={isProcessing || !selectedProduct || !userId}
                                className={`w-full py-4 rounded-xl font-bold transition-all ${isProcessing || !selectedProduct ? "bg-gray-600 cursor-not-allowed" : "bg-green-600 hover:bg-green-500"}`}
                            >
                                {isProcessing ? "Memproses..." : "BELI SEKARANG"}
                            </button>
                        </div>
                    </div>

                </div>
            </div>
            <PaymentModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                data={transactionData}
            />
        </main>
    );
}