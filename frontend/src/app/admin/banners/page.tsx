"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

// Tipe Data Sesuai Backend Baru
interface Banner {
  ID: number;
  image_url: string;
  target_url: string; // ✅ Ganti description jadi target_url
  is_active: boolean;
  expires_at: string | null;
}

export default function BannersPage() {
  const router = useRouter();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState<number | null>(null);
  
  const [formData, setFormData] = useState({
    image_url: "",
    target_url: "",
    is_active: true,
    expires_at: "",
  });

  const fetchBanners = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:3001/api/admin/banners", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      setBanners(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Gagal load banners:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBanners(); }, [fetchBanners]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    if (!token) return router.push("/admin/login");

    const url = isEditing 
      ? `http://localhost:3001/api/admin/banners/${currentId}`
      : "http://localhost:3001/api/admin/banners";
    
    const method = isEditing ? "PUT" : "POST";

    const payload = {
        ...formData,
        expires_at: formData.expires_at === "" ? null : new Date(formData.expires_at).toISOString()
    };

    try {
      const res = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setIsModalOpen(false);
        resetForm();
        fetchBanners();
      } else {
        alert("Gagal menyimpan banner.");
      }
    } catch (error) { console.error(error); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Hapus banner ini?")) return;
    const token = localStorage.getItem("token");
    const res = await fetch(`http://localhost:3001/api/admin/banners/${id}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${token}` },
    });
    if (res.ok) fetchBanners();
  };

  const handleToggleStatus = async (banner: Banner) => {
    const token = localStorage.getItem("token");
    const newStatus = !banner.is_active;
    const res = await fetch(`http://localhost:3001/api/admin/banners/${banner.ID}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ ...banner, is_active: newStatus }),
    });
    if (res.ok) setBanners(prev => prev.map(b => b.ID === banner.ID ? { ...b, is_active: newStatus } : b));
  };

  const openAddModal = () => { resetForm(); setIsModalOpen(true); };

  const openEditModal = (banner: Banner) => {
    setIsEditing(true);
    setCurrentId(banner.ID);
    
    let formattedDate = "";
    if (banner.expires_at) {
        const date = new Date(banner.expires_at);
        const offset = date.getTimezoneOffset() * 60000;
        formattedDate = new Date(date.getTime() - offset).toISOString().slice(0, 16);
    }

    setFormData({
      image_url: banner.image_url,
      target_url: banner.target_url || "",
      is_active: banner.is_active,
      expires_at: formattedDate,
    });
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setIsEditing(false);
    setCurrentId(null);
    setFormData({ image_url: "", target_url: "", is_active: true, expires_at: "" });
  };

  const isExpired = (dateString: string | null) => dateString ? new Date(dateString) < new Date() : false;

  return (
    <div className="p-6 w-full max-w-[1920px] mx-auto min-h-screen pb-20">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">🖼️ Banner Promo</h1>
          <p className="text-gray-400 text-sm mt-1">Kelola banner flash sale & event.</p>
        </div>
        <button onClick={openAddModal} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold shadow-lg transition-transform hover:scale-105">
          ➕ Tambah Banner
        </button>
      </div>

      {/* LIST BANNERS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {banners.map((banner) => {
            const expired = isExpired(banner.expires_at);
            return (
                <div key={banner.ID} className={`group relative bg-gray-900 border rounded-2xl overflow-hidden transition-all hover:-translate-y-1 hover:shadow-2xl ${
                    expired ? "border-red-900/50 opacity-60" : banner.is_active ? "border-gray-800" : "border-gray-800 opacity-75 grayscale"
                }`}>
                
                {/* PREVIEW IMAGE */}
                <div className="aspect-video w-full bg-black relative">
                    <img src={banner.image_url} className="w-full h-full object-cover" onError={(e) => (e.currentTarget.src = "https://placehold.co/600x400/1f2937/white?text=No+Image")} />
                    
                    {/* STATUS BADGES */}
                    <div className="absolute top-3 left-3 flex flex-col gap-1">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase backdrop-blur-md border ${
                            banner.is_active ? "bg-green-500/20 text-green-300 border-green-500/30" : "bg-gray-500/20 text-gray-300 border-gray-500/30"
                        }`}>
                            {banner.is_active ? "● Aktif" : "● Mati"}
                        </span>
                        {expired && <span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-red-600/80 text-white border border-red-500">⚠️ EXPIRED</span>}
                    </div>
                </div>

                {/* INFO */}
                <div className="p-4">
                    <p className="text-xs text-gray-400 mb-1">Target Link:</p>
                    <p className="text-sm text-indigo-400 font-mono truncate mb-4 cursor-pointer hover:underline" title={banner.target_url}>
                        {banner.target_url || "-"}
                    </p>
                    
                    <p className="text-xs text-gray-400 mb-1">Berakhir Pada:</p>
                    <p className="text-xs font-mono mb-4 text-white">
                        {banner.expires_at 
                            ? new Date(banner.expires_at).toLocaleDateString("id-ID", { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                            : "∞ Selamanya"
                        }
                    </p>
                    
                    <div className="flex gap-2 border-t border-gray-800 pt-3">
                        <button onClick={() => handleToggleStatus(banner)} className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-bold transition-colors">
                            {banner.is_active ? "Matikan" : "Aktifkan"}
                        </button>
                        <button onClick={() => openEditModal(banner)} className="p-2 bg-gray-800 hover:bg-gray-700 text-indigo-400 rounded-lg">✏️</button>
                        <button onClick={() => handleDelete(banner.ID)} className="p-2 bg-gray-800 hover:bg-gray-700 text-red-400 rounded-lg">🗑️</button>
                    </div>
                </div>
                </div>
            )})}
      </div>

      {/* MODAL FORM */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in zoom-in-95">
            <div className="bg-gray-900 border border-gray-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
                    <h2 className="font-bold text-white">{isEditing ? "Edit Banner" : "Tambah Banner"}</h2>
                    <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-white">✕</button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* INPUT IMAGE URL */}
                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-1">URL Gambar</label>
                        <input type="text" required className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-xl p-3 outline-none focus:border-indigo-500" placeholder="https://..." value={formData.image_url} onChange={(e) => setFormData({ ...formData, image_url: e.target.value })} />
                    </div>

                    {/* INPUT TARGET URL */}
                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-1">Link Target (Opsional)</label>
                        <input type="text" className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-xl p-3 outline-none focus:border-indigo-500" placeholder="/game/mobile-legends" value={formData.target_url} onChange={(e) => setFormData({ ...formData, target_url: e.target.value })} />
                    </div>

                    {/* INPUT EXPIRED DATE */}
                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-1">Jadwal Expired (Opsional)</label>
                        <input type="datetime-local" className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-xl p-3 outline-none [color-scheme:dark]" value={formData.expires_at} onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })} />
                    </div>

                    {/* TOGGLE ACTIVE */}
                    <div className="flex items-center justify-between bg-gray-800/50 p-3 rounded-xl border border-gray-700">
                        <span className="text-sm text-gray-300 font-medium">Status Aktif</span>
                        <button type="button" onClick={() => setFormData({ ...formData, is_active: !formData.is_active })} className={`relative h-6 w-11 rounded-full transition-colors ${formData.is_active ? "bg-green-500" : "bg-gray-600"}`}>
                            <span className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white transition-transform ${formData.is_active ? "translate-x-5" : ""}`} />
                        </button>
                    </div>

                    <button type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20">
                        {isEditing ? "Simpan Perubahan" : "Publikasikan Banner"}
                    </button>
                </form>
            </div>
        </div>
      )}
    </div>
  );
}

