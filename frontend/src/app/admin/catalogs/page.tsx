"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// Tipe Data
interface Catalog {
    cardcode: string;
    name: string;
    slug: string;
    image_url: string;
    category: string;
    is_active: boolean;
    check_id_code?: string;
}

export default function AdminCatalogPage() {
    const router = useRouter();
    const [catalogs, setCatalogs] = useState<Catalog[]>([]);
    const [loading, setLoading] = useState(true);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8; 

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentCardCode, setCurrentCardCode] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        cardcode: "",
        name: "",
        image_url: "",
        check_id_code: "",
        is_active: true
    });

    useEffect(() => {
        fetchCatalogs();
    }, []);

    const getAuthHeaders = () => {
        const token = localStorage.getItem("token");
        if (!token) {
            router.push("/admin/login");
            return null;
        }
        return {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        };
    };

    const fetchCatalogs = async () => {
        const headers = getAuthHeaders();
        if (!headers) return;
        try {
            const res = await fetch("http://localhost:3001/api/admin/catalogs", { headers });
            const data = await res.json();
            setCatalogs(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Gagal load katalog");
        } finally {
            setLoading(false);
        }
    };

    // --- PAGINATION LOGIC ---
    const totalPages = Math.ceil(catalogs.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = catalogs.slice(indexOfFirstItem, indexOfLastItem);

    // --- MODAL HANDLERS ---
    const openAddModal = () => {
        setIsEditing(false);
        setFormData({ cardcode: "", name: "", image_url: "", check_id_code: "", is_active: true });
        setIsModalOpen(true);
    };

    const openEditModal = (cat: Catalog) => {
        setIsEditing(true);
        setCurrentCardCode(cat.cardcode);
        setFormData({
            cardcode: cat.cardcode,
            name: cat.name,
            image_url: cat.image_url,
            check_id_code: cat.check_id_code || "",
            is_active: cat.is_active
        });
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const headers = getAuthHeaders();
        if (!headers) return;

        const url = isEditing 
            ? `http://localhost:3001/api/admin/catalogs/${currentCardCode}`
            : "http://localhost:3001/api/admin/catalogs";
        const method = isEditing ? "PUT" : "POST";

        try {
            const res = await fetch(url, {
                method: method,
                headers: headers,
                body: JSON.stringify(formData),
            });
            if (res.ok) {
                setIsModalOpen(false);
                fetchCatalogs();
            } else {
                alert("Gagal simpan");
            }
        } catch (error) {
            console.error(error);
        }
    };

    const toggleStatus = async (cat: Catalog) => {
        const newStatus = !cat.is_active;
        if (!confirm(newStatus ? "Aktifkan?" : "Matikan?")) return;
        const headers = getAuthHeaders();
        if (!headers) return;

        try {
            await fetch(`http://localhost:3001/api/admin/catalogs/${cat.cardcode}`, {
                method: "PUT",
                headers: headers,
                body: JSON.stringify({ ...cat, is_active: newStatus }),
            });
            fetchCatalogs();
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="w-full">
            {/* HEADER SECTION */}
            <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4 px-2">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Katalog Game</h1>
                    <p className="text-gray-500 text-sm mt-1">Manage game list & configurations</p>
                </div>
                <button 
                    onClick={openAddModal}
                    className="bg-white text-black hover:bg-gray-200 px-6 py-2.5 rounded-full font-bold text-sm transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                >
                    <span>+</span> Add Game
                </button>
            </div>

            {loading ? (
                <div className="space-y-4 animate-pulse">
                     {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-gray-800/50 rounded-xl border border-white/5"></div>)}
                </div>
            ) : (
                <>
                    {/* 👇 TABEL GAYA BARU (NEON STYLE) */}
                    <div className="w-full overflow-hidden rounded-[24px] border border-white/5 bg-[#0a0a0c]">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-gray-500 uppercase bg-transparent border-b border-white/5 text-[10px] tracking-widest font-bold">
                                    <tr>
                                        <th className="px-6 py-4 w-16">Icon</th>
                                        <th className="px-6 py-4">Game Name</th>
                                        <th className="px-6 py-4">Check ID</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {currentItems.map((cat) => (
                                        <tr key={cat.cardcode} className="hover:bg-white/5 transition-colors duration-200 group">
                                            
                                            {/* IMAGE */}
                                            <td className="px-6 py-4">
                                                <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/10 bg-black/50">
                                                    <img src={cat.image_url || "/file.svg"} alt={cat.name} className="w-full h-full object-cover" />
                                                </div>
                                            </td>

                                            {/* NAME & SLUG */}
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-white text-sm group-hover:text-green-400 transition-colors">
                                                        {cat.name}
                                                    </span>
                                                    <span className="text-[10px] text-gray-600 font-mono mt-0.5 uppercase">
                                                        {cat.cardcode}
                                                    </span>
                                                </div>
                                            </td>
                                            
                                            {/* CHECK ID CODE (Badge Style) */}
                                            <td className="px-6 py-4">
                                                {cat.check_id_code ? (
                                                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-mono font-bold tracking-wide">
                                                        <span className="w-1 h-1 rounded-full bg-indigo-500 animate-pulse"></span>
                                                        {cat.check_id_code}
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-700 text-xs">-</span>
                                                )}
                                            </td>

                                            {/* STATUS (Style Referensi: Hijau Tua) */}
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() => toggleStatus(cat)}
                                                    className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-all border ${
                                                        cat.is_active 
                                                            ? "bg-[#1E481B] border-white/5 text-white shadow-[0_0_10px_rgba(34,197,94,0.2)]" 
                                                            : "bg-red-900/20 border-red-500/20 text-red-500/70 grayscale"
                                                    }`}
                                                >
                                                    {cat.is_active ? "Active" : "Disabled"}
                                                </button>
                                            </td>

                                            {/* ACTIONS */}
                                            <td className="px-6 py-4 text-right">
                                                <button 
                                                    onClick={() => openEditModal(cat)} 
                                                    className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        
                        {/* FOOTER PAGINATION */}
                        <div className="p-4 border-t border-white/5 flex items-center justify-between">
                            <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold px-2">
                                Showing {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, catalogs.length)} of {catalogs.length}
                            </span>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                    className="px-3 py-1 text-xs font-bold text-gray-400 border border-white/10 rounded-full hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition"
                                >
                                    Prev
                                </button>
                                <button 
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages}
                                    className="px-3 py-1 text-xs font-bold text-gray-400 border border-white/10 rounded-full hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* MODAL EDIT/ADD (Style Gelap Minimalis) */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm animate-in fade-in zoom-in-95">
                    <div className="bg-[#0f1014] p-6 rounded-2xl w-full max-w-md border border-white/10 shadow-2xl relative">
                        <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white">✕</button>
                        
                        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <span className="w-1 h-6 bg-green-500 rounded-full"></span>
                            {isEditing ? "Edit Game" : "New Game"}
                        </h3>
                        
                        <form onSubmit={handleSave} className="space-y-5">
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Unique Code</label>
                                <input 
                                    type="text" 
                                    value={formData.cardcode} 
                                    onChange={(e) => setFormData({ ...formData, cardcode: e.target.value })} 
                                    disabled={isEditing}
                                    className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:border-green-500/50 outline-none font-mono text-sm placeholder:text-gray-800 disabled:opacity-50"
                                    placeholder="mobile-legends" 
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Display Name</label>
                                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:border-green-500/50 outline-none text-sm" placeholder="Mobile Legends" />
                            </div>
                            
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Image URL</label>
                                <input type="text" value={formData.image_url} onChange={(e) => setFormData({ ...formData, image_url: e.target.value })} className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:border-green-500/50 outline-none text-sm" placeholder="https://..." />
                            </div>

                            {/* Section Cek ID */}
                            <div className="p-4 rounded-xl border border-indigo-500/10 bg-indigo-500/5">
                                <label className="text-[10px] font-bold text-indigo-400 uppercase mb-1 block">Check ID SKU</label>
                                <input 
                                    type="text" 
                                    value={formData.check_id_code} 
                                    onChange={(e) => setFormData({ ...formData, check_id_code: e.target.value })} 
                                    className="w-full bg-black/50 border border-indigo-500/20 rounded-xl p-3 text-white focus:border-indigo-500 outline-none font-mono text-sm" 
                                    placeholder="CEK-ML" 
                                />
                                <p className="text-[10px] text-indigo-500/50 mt-1">Kosongkan jika game tidak butuh cek ID.</p>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 rounded-xl border border-white/10 text-gray-400 hover:text-white font-bold text-xs hover:bg-white/5 transition">Cancel</button>
                                <button type="submit" className="flex-1 py-3 rounded-xl bg-white text-black hover:bg-gray-200 font-bold text-xs transition shadow-lg shadow-white/5">Save Changes</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}