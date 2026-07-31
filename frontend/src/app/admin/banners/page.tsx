"use client";

import { useState, useEffect, useCallback } from "react";
import NextImage from "next/image";
import { useApi } from "@/hooks/useApi";
import {
  Plus,
  Edit2,
  Trash2,
  Power,
  AlertCircle,
  Image as ImageIcon,
  AlertTriangle,
} from "lucide-react";

interface Banner {
  ID: number;
  image_url: string;
  target_url: string;
  is_active: boolean;
  expires_at: string | null;
}

export default function BannersPage() {
  const { get, post, put, delete: del } = useApi();

  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);

  // State Modal Form
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState<number | null>(null);

  // State Modal Delete
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [bannerToDelete, setBannerToDelete] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    image_url: "",
    target_url: "",
    is_active: true,
    expires_at: "",
  });

  const fetchBanners = useCallback(async () => {
    try {
      const res = await get("/admin/banners");
      if (res.ok) {
        const data = await res.json();
        setBanners(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Gagal load banners:", error);
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    fetchBanners();
  }, [fetchBanners]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const endpoint = isEditing
      ? `/admin/banners/${currentId}`
      : "/admin/banners";
    const payload = {
      ...formData,
      expires_at:
        formData.expires_at === ""
          ? null
          : new Date(formData.expires_at).toISOString(),
    };

    try {
      const res = await (isEditing
        ? put(endpoint, payload)
        : post(endpoint, payload));

      if (res.ok) {
        setIsModalOpen(false);
        resetForm();
        fetchBanners();
      } else {
        alert("Gagal menyimpan banner.");
      }
    } catch (error) {
      console.error(error);
      alert("Terjadi kesalahan sistem saat menyimpan banner.");
    }
  };

  // Logic Hapus Baru (Pakai Modal)
  const confirmDelete = (id: number) => {
    setBannerToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const executeDelete = async () => {
    if (!bannerToDelete) return;

    try {
      const res = await del(`/admin/banners/${bannerToDelete}`);
      if (res.ok) {
        fetchBanners();
        setIsDeleteModalOpen(false);
        setBannerToDelete(null);
      }
    } catch (error) {
      console.error("Gagal hapus banner", error);
    }
  };

  const handleToggleStatus = async (banner: Banner) => {
    const newStatus = !banner.is_active;

    try {
      const res = await put(`/admin/banners/${banner.ID}`, {
        ...banner,
        is_active: newStatus,
      });

      if (res.ok) {
        setBanners((prev) =>
          prev.map((b) =>
            b.ID === banner.ID ? { ...b, is_active: newStatus } : b,
          ),
        );
      }
    } catch (error) {
      console.error("Gagal ubah status", error);
    }
  };

  const openAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (banner: Banner) => {
    setIsEditing(true);
    setCurrentId(banner.ID);

    let formattedDate = "";
    if (banner.expires_at) {
      const date = new Date(banner.expires_at);
      const offset = date.getTimezoneOffset() * 60000;
      formattedDate = new Date(date.getTime() - offset)
        .toISOString()
        .slice(0, 16);
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
    setFormData({
      image_url: "",
      target_url: "",
      is_active: true,
      expires_at: "",
    });
  };

  const isExpired = (dateString: string | null) =>
    dateString ? new Date(dateString) < new Date() : false;

  if (loading)
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="animate-spin text-[#E491C9]">
          <Power size={40} />
        </div>
      </div>
    );

  return (
    <div className="w-full max-w-[1920px] mx-auto min-h-screen pb-20 relative">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 gap-4 px-2">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3 tracking-tight drop-shadow-md uppercase">
            <ImageIcon className="text-[#E491C9]" size={32} /> Banner Promo
          </h1>
          <p className="text-white/50 text-sm mt-1.5 font-medium tracking-wide">
            Kelola banner carousel, flash sale & event promo toko.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="group relative px-6 py-3 bg-[#E491C9]/10 hover:bg-[#E491C9]/20 text-[#E491C9] border border-[#E491C9]/30 hover:border-[#E491C9]/60 rounded-2xl text-sm font-bold shadow-[0_0_15px_rgba(228,145,201,0.1)] hover:shadow-[0_0_25px_rgba(228,145,201,0.3)] transition-all flex items-center gap-2 active:scale-95"
        >
          <Plus
            size={18}
            className="group-hover:rotate-90 transition-transform duration-300"
          />{" "}
          Tambah Banner
        </button>
      </div>

      {/* LIST BANNERS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 px-2">
        {banners.length === 0 ? (
          <div className="col-span-full py-24 text-center bg-white/[0.02] border border-white/[0.05] rounded-[32px] backdrop-blur-xl">
            <div className="flex flex-col items-center justify-center opacity-40 hover:opacity-70 transition-opacity">
              <ImageIcon size={64} className="mb-4 text-white" />
              <p className="text-white/60 font-medium tracking-wide">
                Belum ada banner terpasang.
              </p>
            </div>
          </div>
        ) : (
          banners.map((banner) => {
            const expired = isExpired(banner.expires_at);
            return (
              <div
                key={banner.ID}
                className={`group relative bg-white/[0.02] backdrop-blur-[24px] border rounded-[24px] overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_15px_40px_rgba(0,0,0,0.3)] flex flex-col ${
                  expired
                    ? "border-red-500/20 opacity-70"
                    : banner.is_active
                      ? "border-white/[0.08]"
                      : "border-white/[0.04] grayscale-[50%]"
                }`}
              >
                {/* PREVIEW IMAGE KACA */}
                <div className="aspect-video w-full bg-black/50 relative overflow-hidden">
                  <NextImage
                    src={banner.image_url || "/file.svg"}
                    alt="Preview banner promosi"
                    fill
                    unoptimized
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    onError={(e) =>
                      (e.currentTarget.src =
                        "https://placehold.co/600x400/15173d/white?text=No+Image")
                    }
                  />

                  <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/60 opacity-80" />

                  <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase backdrop-blur-md border shadow-lg ${
                        banner.is_active
                          ? "bg-[#9effba]/10 text-[#9effba] border-[#9effba]/30 shadow-[#9effba]/10"
                          : "bg-white/10 text-white/60 border-white/20"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          banner.is_active
                            ? "bg-[#9effba] shadow-[0_0_8px_#9effba]"
                            : "bg-white/40"
                        }`}
                      ></span>
                      {banner.is_active ? "Aktif" : "Non-aktif"}
                    </span>

                    {expired && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase bg-red-500/20 text-red-400 border border-red-500/30 backdrop-blur-md shadow-[0_0_10px_rgba(239,68,68,0.2)]">
                        <AlertCircle size={12} /> Expired
                      </span>
                    )}
                  </div>
                </div>

                {/* INFO PANEL */}
                <div className="p-5 flex-1 flex flex-col relative z-10">
                  <div className="flex-1">
                    <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-1">
                      Target URL
                    </p>
                    <p
                      className="text-sm text-[#E491C9] font-mono truncate mb-4 cursor-pointer hover:text-white transition-colors"
                      title={banner.target_url}
                    >
                      {banner.target_url || "— No Target —"}
                    </p>

                    <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-1">
                      Berakhir Pada
                    </p>
                    <p className="text-xs font-mono mb-4 text-white/80 bg-white/5 inline-block px-2.5 py-1 rounded-lg border border-white/5">
                      {banner.expires_at
                        ? new Date(banner.expires_at).toLocaleDateString(
                            "id-ID",
                            {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )
                        : "∞ Berlaku Selamanya"}
                    </p>
                  </div>

                  {/* ACTION BUTTONS */}
                  <div className="flex gap-2 pt-4 border-t border-white/[0.05] mt-auto">
                    <button
                      onClick={() => handleToggleStatus(banner)}
                      className="flex-1 py-2.5 bg-white/[0.03] hover:bg-white/[0.1] text-white/80 hover:text-white rounded-xl border border-white/5 text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      <Power
                        size={14}
                        className={
                          banner.is_active ? "text-red-400" : "text-[#9effba]"
                        }
                      />
                      {banner.is_active ? "Matikan" : "Aktifkan"}
                    </button>
                    <button
                      onClick={() => openEditModal(banner)}
                      className="p-2.5 bg-white/[0.03] hover:bg-blue-500/20 text-blue-400 rounded-xl border border-white/5 hover:border-blue-500/30 transition-all active:scale-95"
                      title="Edit"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => confirmDelete(banner.ID)}
                      className="p-2.5 bg-white/[0.03] hover:bg-red-500/20 text-red-400 rounded-xl border border-white/5 hover:border-red-500/30 transition-all active:scale-95"
                      title="Hapus"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 🚀 1. ULTRA-GLASS MODAL FORM (TAMBAH/EDIT) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all duration-300">
          <div
            className="absolute inset-0"
            onClick={() => setIsModalOpen(false)}
          ></div>

          {/* Menggunakan style CardBase (Glassmorphism Minimalis) */}
          <div className="relative w-full max-w-md overflow-hidden bg-gradient-to-br from-white/[0.05] to-transparent backdrop-blur-[40px] backdrop-saturate-[200%] border border-white/[0.08] shadow-[0_16px_40px_0_rgba(0,0,0,0.5),inset_0_1px_2px_rgba(255,255,255,0.15),inset_0_-1px_2px_rgba(255,255,255,0.05)] rounded-[32px] p-8 animate-in fade-in zoom-in-95 duration-300">
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.3] to-transparent opacity-50" />

            <div className="relative z-10">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                <span className="w-2 h-6 bg-gradient-to-b from-[#e491c9] to-purple-600 rounded-full"></span>
                {isEditing ? "Edit Banner" : "New Banner"}
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-purple-300/70 uppercase tracking-widest mb-1 block">
                    URL Gambar
                  </label>
                  <input
                    type="url"
                    required
                    className="w-full bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 text-white focus:border-purple-500/50 outline-none font-mono text-sm placeholder:text-gray-700 transition-colors"
                    placeholder="https://..."
                    value={formData.image_url}
                    onChange={(e) =>
                      setFormData({ ...formData, image_url: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-purple-300/70 uppercase tracking-widest mb-1 block">
                    Link Target
                  </label>
                  <input
                    type="text"
                    className="w-full bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 text-white focus:border-purple-500/50 outline-none text-sm transition-colors"
                    placeholder="/game/..."
                    value={formData.target_url}
                    onChange={(e) =>
                      setFormData({ ...formData, target_url: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-purple-300/70 uppercase tracking-widest mb-1 block">
                    Jadwal Expired
                  </label>
                  <input
                    type="datetime-local"
                    className="w-full bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 text-white focus:border-purple-500/50 outline-none text-sm transition-colors [color-scheme:dark]"
                    value={formData.expires_at}
                    onChange={(e) =>
                      setFormData({ ...formData, expires_at: e.target.value })
                    }
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-3 bg-white/[0.02] hover:bg-white/[0.08] text-slate-300 hover:text-white rounded-xl text-xs font-bold uppercase tracking-widest border border-white/[0.05] hover:border-white/[0.15] transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-white/[0.85] hover:bg-white text-[#15173d] rounded-xl text-xs font-bold uppercase tracking-widest transition-all"
                  >
                    Save Data
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 🚀 2. CUSTOM DELETE MODAL */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
            onClick={() => setIsDeleteModalOpen(false)}
          ></div>

          <div className="relative w-full max-w-sm bg-[#150a0a]/90 backdrop-blur-[40px] border border-red-500/20 rounded-[32px] shadow-[0_0_60px_rgba(239,68,68,0.15)] p-8 text-center animate-in zoom-in-95 duration-200 overflow-hidden">
            {/* Glow Merah */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-red-500/20 rounded-full blur-[50px] pointer-events-none"></div>

            <div className="relative z-10">
              <div className="w-16 h-16 mx-auto bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                <AlertTriangle size={32} className="text-red-400" />
              </div>

              <h3 className="text-xl font-black text-white mb-2 uppercase tracking-wide">
                Hapus Banner?
              </h3>
              <p className="text-sm text-white/50 mb-8 font-medium">
                Tindakan ini permanen dan banner nggak akan bisa dikembalikan
                lagi.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 py-3 bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 rounded-xl text-white font-bold text-sm transition-all active:scale-95"
                >
                  Batal
                </button>
                <button
                  onClick={executeDelete}
                  className="flex-1 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-xl text-red-400 font-bold text-sm shadow-[0_0_15px_rgba(239,68,68,0.2)] transition-all active:scale-95"
                >
                  Ya, Hapus
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
