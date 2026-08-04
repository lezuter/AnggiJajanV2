"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useApi } from "@/hooks/useApi";

// Tipe Data
interface Catalog {
  cardcode: string;
  name: string;
  slug: string;
  short_name: string;
  category: string;
  publisher: string;
  region: string;
  description: string;
  image_url: string;
  banner_url: string;
  check_id_code: string;
  is_active: boolean;
  is_public: boolean;
  is_popular: boolean;
  sort_order: number;
  markup_percent?: number | null;
}

const markupNumberFormatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 10,
});

const parseMarkupPercentInput = (rawValue: string): number | null | undefined => {
  const normalizedValue = rawValue.trim().replace(",", ".");
  if (normalizedValue === "") return null;

  const value = Number(normalizedValue);
  if (!Number.isFinite(value) || value < 0 || value > 100) return undefined;
  return value;
};

const formatMarkupPercent = (value: number) => markupNumberFormatter.format(value);

const readResponseError = async (response: Response, fallback: string) => {
  try {
    const payload = (await response.json()) as { error?: unknown };
    return typeof payload.error === "string" && payload.error.trim()
      ? payload.error
      : fallback;
  } catch {
    return fallback;
  }
};

// ✨ PREMIUM GLASSMORPHISM CARD (Biar seragam sama Dashboard) ✨
const CardBase = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={`relative overflow-hidden bg-gradient-to-br from-white/[0] to-transparent backdrop-blur-[100px] backdrop-saturate-[200%] border border-white/[0.04] shadow-[0_8px_32px_0_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(255,255,255,0.02)] rounded-[28px] transition-all duration-700 ease-out hover:-translate-y-1 hover:bg-gradient-to-br hover:from-white/[0.04] hover:to-transparent hover:shadow-[0_16px_40px_0_rgba(0,0,0,0.2),inset_0_1px_2px_rgba(255,255,255,0.15)] ${className}`}
  >
    <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.15] to-transparent opacity-40" />
    <div className="relative z-10">{children}</div>
  </div>
);

export default function AdminCatalogPage() {
  const { get, post, put } = useApi();

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
    slug: "",
    short_name: "",
    category: "",
    publisher: "",
    region: "",
    description: "",
    image_url: "",
    banner_url: "",
    check_id_code: "",
    is_active: true,
    is_public: true,
    is_popular: false,
    sort_order: 0,
    markup_percent: "",
  });

  const fetchCatalogs = useCallback(async () => {
    try {
      const res = await get("/admin/catalogs");
      if (res.ok) {
        const data = await res.json();
        setCatalogs(Array.isArray(data) ? data : []);
      }
    } catch {
      console.error("Gagal load katalog");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    fetchCatalogs();
  }, [fetchCatalogs]);

  // --- PAGINATION LOGIC ---
  const totalPages = Math.ceil(catalogs.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = catalogs.slice(indexOfFirstItem, indexOfLastItem);

  // --- MODAL HANDLERS ---
  const openAddModal = () => {
    setIsEditing(false);
    setFormData({
      cardcode: "",
      name: "",
      slug: "",
      short_name: "",
      category: "",
      publisher: "",
      region: "",
      description: "",
      image_url: "",
      banner_url: "",
      check_id_code: "",
      is_active: true,
      is_public: true,
      is_popular: false,
      sort_order: 0,
      markup_percent: "",
    });
    setIsModalOpen(true);
  };

  const openEditModal = (cat: Catalog) => {
    setIsEditing(true);
    setCurrentCardCode(cat.cardcode);
    setFormData({
      cardcode: cat.cardcode,
      name: cat.name,
      slug: cat.slug || "",
      short_name: cat.short_name || "",
      category: cat.category || "",
      publisher: cat.publisher || "",
      region: cat.region || "",
      description: cat.description || "",
      image_url: cat.image_url,
      banner_url: cat.banner_url || "",
      check_id_code: cat.check_id_code || "",
      is_active: cat.is_active,
      is_public: cat.is_public ?? true,
      is_popular: cat.is_popular ?? false,
      sort_order: cat.sort_order ?? 0,
      markup_percent:
        cat.markup_percent === null || cat.markup_percent === undefined
          ? ""
          : String(cat.markup_percent),
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const markupPercent = parseMarkupPercentInput(formData.markup_percent);
    if (markupPercent === undefined) {
      alert("Markup harus berupa angka 0 sampai 100.");
      return;
    }

    const endpoint = isEditing
      ? `/admin/catalogs/${currentCardCode}`
      : "/admin/catalogs";
    const payload = {
      ...formData,
      markup_percent: markupPercent,
    };

    try {
      const res = await (isEditing
        ? put(endpoint, payload)
        : post(endpoint, payload));
      if (res.ok) {
        setIsModalOpen(false);
        fetchCatalogs();
      } else {
        alert(await readResponseError(res, "Gagal menyimpan data."));
      }
    } catch (error) {
      console.error(error);
      alert("Terjadi kesalahan sistem saat menyimpan.");
    }
  };

  const toggleStatus = async (cat: Catalog) => {
    const newStatus = !cat.is_active;
    if (!confirm(newStatus ? "Aktifkan game ini?" : "Matikan game ini?"))
      return;

    try {
      const res = await put(`/admin/catalogs/${cat.cardcode}`, {
        ...cat,
        is_active: newStatus,
        markup_percent: cat.markup_percent ?? null,
      });
      if (res.ok) fetchCatalogs();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="w-full max-w-[1920px] mx-auto pb-10">
      {/* HEADER SECTION (Seragam sama Dashboard) */}
      <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-4">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3 uppercase tracking-tight">
            <span className="w-2 h-8 bg-gradient-to-b from-[#e491c9] to-purple-600 rounded-full"></span>
            Katalog Game
          </h1>
          <p className="text-purple-300/70 text-sm mt-1 ml-5 tracking-widest uppercase text-[10px] font-bold">
            Manage game list & configurations
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold uppercase tracking-widest border border-white/20 hover:border-white/40 transition-all flex items-center gap-2 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
        >
          <span>➕</span> Add New Game
        </button>
      </div>

      {loading ? (
        <div className="space-y-4 animate-pulse">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-16 bg-white/5 rounded-2xl border border-white/5"
            ></div>
          ))}
        </div>
      ) : (
        <CardBase className="p-8">
          {/* TABEL GLASSMORPHISM */}
          <div className="overflow-x-auto pb-2">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr>
                  <th className="pb-4 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-white/[0.05] w-16">
                    Icon
                  </th>
                  <th className="pb-4 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-white/[0.05]">
                    Game Name
                  </th>
                  <th className="pb-4 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-white/[0.05]">
                    Check ID
                  </th>
                  <th className="pb-4 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-white/[0.05]">
                    Markup
                  </th>
                  <th className="pb-4 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-white/[0.05] text-center">
                    Status
                  </th>
                  <th className="pb-4 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-white/[0.05] text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {currentItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-12 text-center text-slate-500/50 italic tracking-widest font-mono text-xs"
                    >
                      Data katalog masih kosong...
                    </td>
                  </tr>
                ) : (
                  currentItems.map((cat) => (
                    <tr
                      key={cat.cardcode}
                      className="group hover:bg-white/[0.03] transition-all duration-300 border-b border-white/[0.02] last:border-0"
                    >
                      {/* IMAGE */}
                      <td className="py-4 px-2">
                        <div className="relative w-10 h-10 rounded-xl overflow-hidden border border-white/10 bg-white/5 shadow-inner">
                          <Image
                            src={cat.image_url || "/file.svg"}
                            alt={cat.name}
                            fill
                            unoptimized
                            sizes="40px"
                            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                          />
                        </div>
                      </td>

                      {/* NAME & SLUG */}
                      <td className="py-4 px-2">
                        <div className="text-slate-200 font-medium truncate max-w-[200px] group-hover:text-white transition-colors">
                          {cat.name}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-1 tracking-[0.1em] group-hover:text-slate-400 transition-colors uppercase">
                          {cat.cardcode}
                        </div>
                      </td>

                      {/* CHECK ID CODE */}
                      <td className="py-4 px-2">
                        {cat.check_id_code ? (
                          <span className="inline-flex px-3 py-1 bg-sky-500/[0.08] text-sky-400 border border-sky-500/20 rounded-full text-[9px] font-mono font-bold tracking-widest items-center gap-2 group-hover:shadow-[0_0_12px_rgba(56,189,248,0.2)]">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></span>
                            {cat.check_id_code}
                          </span>
                        ) : (
                          <span className="text-slate-600 font-bold">-</span>
                        )}
                      </td>

                      {/* MARKUP */}
                      <td className="py-4 px-2">
                        <span className="inline-flex rounded-full border border-purple-400/15 bg-purple-400/[0.055] px-2.5 py-1 text-[10px] font-medium text-purple-100/70">
                          {typeof cat.markup_percent === "number" &&
                          Number.isFinite(cat.markup_percent)
                            ? `${formatMarkupPercent(cat.markup_percent)}% · Khusus`
                            : "5% · Default"}
                        </span>
                      </td>

                      {/* STATUS */}
                      <td className="py-4 px-2 text-center">
                        <button
                          onClick={() => toggleStatus(cat)}
                          className={`inline-flex w-[85px] justify-center items-center py-1.5 rounded-full text-[9px] font-bold tracking-[0.15em] uppercase border backdrop-blur-md transition-all duration-300
                                                        ${
                                                          cat.is_active
                                                            ? "bg-emerald-500/[0.08] text-emerald-400 border-emerald-500/20 hover:shadow-[0_0_12px_rgba(16,185,129,0.3)] hover:bg-emerald-500/[0.15]"
                                                            : "bg-red-500/[0.08] text-red-400 border-red-500/20 hover:shadow-[0_0_12px_rgba(239,68,68,0.3)] hover:bg-red-500/[0.15]"
                                                        }`}
                        >
                          {cat.is_active ? "Active" : "Disabled"}
                        </button>
                      </td>

                      {/* ACTIONS */}
                      <td className="py-4 px-2 text-right">
                        <button
                          onClick={() => openEditModal(cat)}
                          className="text-slate-500 hover:text-[#e491c9] bg-white/[0.02] hover:bg-[#e491c9]/10 p-2 rounded-full transition-all duration-300 border border-white/[0.02] hover:border-[#e491c9]/30 hover:shadow-[0_0_10px_rgba(228,145,201,0.2)]"
                          title="Edit Catalog"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* FOOTER PAGINATION */}
          <div className="mt-6 flex items-center justify-between border-t border-white/[0.05] pt-4">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
              Showing {indexOfFirstItem + 1}-
              {Math.min(indexOfLastItem, catalogs.length)} of {catalogs.length}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-white/[0.02] hover:bg-white/[0.08] text-slate-300 hover:text-white rounded-xl text-[10px] font-bold uppercase tracking-widest border border-white/[0.05] hover:border-white/[0.15] disabled:opacity-30 disabled:hover:bg-white/[0.02] transition-all"
              >
                Prev
              </button>
              <button
                onClick={() =>
                  setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                }
                disabled={currentPage === totalPages || totalPages === 0}
                className="px-4 py-2 bg-white/[0.02] hover:bg-white/[0.08] text-slate-300 hover:text-white rounded-xl text-[10px] font-bold uppercase tracking-widest border border-white/[0.05] hover:border-white/[0.15] disabled:opacity-30 disabled:hover:bg-white/[0.02] transition-all"
              >
                Next
              </button>
            </div>
          </div>
        </CardBase>
      )}

      {/* 🔥 MODAL GLASSMORPHISM 🔥 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 p-3 backdrop-blur-md transition-all duration-300 sm:p-6">
          <div
            className="absolute inset-0"
            onClick={() => setIsModalOpen(false)}
          ></div>

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="catalog-modal-title"
            className="relative max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl overflow-y-auto rounded-[28px] border border-white/[0.09] bg-[#0d0a14]/95 p-5 shadow-[0_32px_100px_rgba(0,0,0,0.65),inset_0_1px_1px_rgba(255,255,255,0.1)] backdrop-blur-[40px] backdrop-saturate-[180%] [scrollbar-color:rgba(168,85,247,0.32)_transparent] [scrollbar-width:thin] animate-in fade-in zoom-in-95 duration-300 sm:max-h-[calc(100dvh-3rem)] sm:rounded-[32px] sm:p-7 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-purple-400/30 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1.5"
          >
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.3] to-transparent opacity-50" />

            <div className="relative z-10">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="Tutup modal"
                className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.025] text-lg text-white/45 transition-colors hover:border-white/[0.16] hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="none"
                  className="h-4 w-4"
                >
                  <path
                    d="m5 5 10 10M15 5 5 15"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
              <h3
                id="catalog-modal-title"
                className="mb-2 flex items-center gap-3 pr-14 text-xl font-bold text-white sm:text-2xl"
              >
                <span className="w-2 h-6 bg-gradient-to-b from-[#e491c9] to-purple-600 rounded-full shadow-[0_0_12px_rgba(228,145,201,0.6)]"></span>
                {isEditing ? "Edit Catalog" : "New Catalog"}
              </h3>
              <p className="mb-6 ml-5 text-xs leading-5 text-white/40">
                Lengkapi identitas, media, dan pengaturan katalog.
              </p>

              <form
                onSubmit={handleSave}
                className="grid grid-cols-1 gap-4 sm:grid-cols-2"
              >
                <div>
                  <label className="text-[10px] font-bold text-purple-300/70 uppercase tracking-widest mb-1 block">
                    Unique Code
                  </label>
                  <input
                    type="text"
                    value={formData.cardcode}
                    onChange={(e) =>
                      setFormData({ ...formData, cardcode: e.target.value })
                    }
                    disabled={isEditing}
                    className="w-full bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 text-white focus:border-purple-500/50 outline-none font-mono text-sm placeholder:text-gray-700 disabled:opacity-40 transition-colors"
                    placeholder="contoh: mobile-legends"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-purple-300/70 uppercase tracking-widest mb-1 block">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 text-white focus:border-purple-500/50 outline-none text-sm transition-colors"
                    placeholder="Mobile Legends"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-purple-300/70 uppercase tracking-widest mb-1 block">
                    Slug
                  </label>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) =>
                      setFormData({ ...formData, slug: e.target.value })
                    }
                    className="w-full bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 text-white focus:border-purple-500/50 outline-none font-mono text-sm transition-colors"
                    placeholder="mobile-legends"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-purple-300/70 uppercase tracking-widest mb-1 block">
                    Short Name
                  </label>
                  <input
                    type="text"
                    value={formData.short_name}
                    onChange={(e) =>
                      setFormData({ ...formData, short_name: e.target.value })
                    }
                    className="w-full bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 text-white focus:border-purple-500/50 outline-none font-mono text-sm transition-colors"
                    placeholder="ML, FF, PUBGM"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-purple-300/70 uppercase tracking-widest mb-1 block">
                    Category
                  </label>
                  <input
                    list="catalog-category-options"
                    type="text"
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    className="w-full bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 text-white focus:border-purple-500/50 outline-none text-sm transition-colors"
                    placeholder="Pilih atau ketik kategori"
                  />
                  <datalist id="catalog-category-options">
                    <option value="game">Game</option>
                    <option value="voucher">Voucher</option>
                    <option value="pulsa-data">Pulsa & Data</option>
                    <option value="internal">Internal</option>
                  </datalist>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-purple-300/70 uppercase tracking-widest mb-1 block">
                    Publisher / Developer
                  </label>
                  <input
                    type="text"
                    value={formData.publisher}
                    onChange={(e) =>
                      setFormData({ ...formData, publisher: e.target.value })
                    }
                    className="w-full bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 text-white focus:border-purple-500/50 outline-none text-sm transition-colors"
                    placeholder="MOONTON, KRAFTON, GARENA, TENCENT GAMES"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-purple-300/70 uppercase tracking-widest mb-1 block">
                    Region
                  </label>
                  <input
                    list="catalog-region-options"
                    type="text"
                    value={formData.region}
                    onChange={(e) =>
                      setFormData({ ...formData, region: e.target.value })
                    }
                    className="w-full bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 text-white focus:border-purple-500/50 outline-none text-sm transition-colors"
                    placeholder="Pilih atau ketik region"
                  />
                  <datalist id="catalog-region-options">
                    <option value="Indonesia" />
                    <option value="Philippines" />
                    <option value="Malaysia" />
                    <option value="Singapore" />
                    <option value="Thailand" />
                    <option value="Vietnam" />
                    <option value="Global" />
                  </datalist>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-purple-300/70 uppercase tracking-widest mb-1 block">
                    Urutan Tampil
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={formData.sort_order}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        sort_order: Number(e.target.value),
                      })
                    }
                    className="w-full bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 text-white focus:border-purple-500/50 outline-none font-mono text-sm transition-colors"
                  />
                  <p className="mt-1.5 text-[9px] font-mono text-purple-300/40">
                    Angka lebih kecil tampil lebih dulu. Contoh: 0, 1, 2.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="catalog-markup-percent"
                    className="text-[10px] font-bold text-purple-300/70 uppercase tracking-widest mb-1 block"
                  >
                    Markup keuntungan (%)
                  </label>
                  <input
                    id="catalog-markup-percent"
                    type="text"
                    inputMode="decimal"
                    value={formData.markup_percent}
                    aria-describedby="catalog-markup-percent-helper"
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        markup_percent: e.target.value,
                      })
                    }
                    className="w-full bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 text-white focus:border-purple-500/50 outline-none font-mono text-sm transition-colors"
                    placeholder="5 atau 2,5"
                  />
                  <p
                    id="catalog-markup-percent-helper"
                    className="mt-1.5 text-[9px] font-mono text-purple-300/40"
                  >
                    Kosongkan untuk memakai markup global 5%.
                  </p>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold text-purple-300/70 uppercase tracking-widest mb-1 block">
                    Catalog Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="min-h-24 w-full resize-y bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 text-white focus:border-purple-500/50 outline-none text-sm transition-colors"
                    placeholder="Diamond Mobile Legends"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-purple-300/70 uppercase tracking-widest mb-1 block">
                    Cover katalog
                  </label>
                  <input
                    type="text"
                    value={formData.image_url}
                    onChange={(e) =>
                      setFormData({ ...formData, image_url: e.target.value })
                    }
                    className="w-full bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 text-white focus:border-purple-500/50 outline-none text-sm transition-colors"
                    placeholder="https://..."
                  />
                  <p className="mt-1.5 text-[9px] font-mono text-purple-300/40">
                    Rekomendasi 1080x1350, rasio 4:5.
                  </p>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-purple-300/70 uppercase tracking-widest mb-1 block">
                    Banner halaman beli
                  </label>
                  <input
                    type="text"
                    value={formData.banner_url}
                    onChange={(e) =>
                      setFormData({ ...formData, banner_url: e.target.value })
                    }
                    className="w-full bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 text-white focus:border-purple-500/50 outline-none text-sm transition-colors"
                    placeholder="https://..."
                  />
                  <p className="mt-1.5 text-[9px] font-mono text-purple-300/40">
                    Rekomendasi 1920x550, rasio sekitar 3.49:1.
                  </p>
                </div>

                <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.02] p-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)] sm:col-span-2">
                  <label className="text-[10px] font-bold text-sky-400 uppercase tracking-widest mb-1 block">
                    Check ID SKU
                  </label>
                  <input
                    type="text"
                    value={formData.check_id_code}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        check_id_code: e.target.value,
                      })
                    }
                    className="w-full bg-white/[0.02] border border-sky-500/30 rounded-xl p-3 text-sky-100 focus:border-sky-400 outline-none font-mono text-sm placeholder:text-sky-900/50 transition-colors"
                    placeholder="CEK-ML"
                  />
                  <p className="text-[9px] text-sky-500/50 mt-1.5 font-mono">
                    Kosongkan jika game tidak butuh cek ID.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:col-span-2 sm:grid-cols-3">
                  <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 text-[10px] font-bold uppercase tracking-widest text-purple-300/70">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          is_active: e.target.checked,
                        })
                      }
                      className="h-4 w-4 accent-purple-500"
                    />
                    Active
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 text-[10px] font-bold uppercase tracking-widest text-purple-300/70">
                    <input
                      type="checkbox"
                      checked={formData.is_public}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          is_public: e.target.checked,
                        })
                      }
                      className="h-4 w-4 accent-purple-500"
                    />
                    Public
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 text-[10px] font-bold uppercase tracking-widest text-purple-300/70">
                    <input
                      type="checkbox"
                      checked={formData.is_popular}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          is_popular: e.target.checked,
                        })
                      }
                      className="h-4 w-4 accent-purple-500"
                    />
                    Popular
                  </label>
                </div>

                <div className="sticky bottom-0 z-20 flex gap-3 rounded-2xl border border-white/[0.07] bg-[#0d0a14]/95 p-3 shadow-[0_-14px_34px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:col-span-2 sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-3 bg-white/[0.02] hover:bg-white/[0.08] text-slate-300 hover:text-white rounded-xl text-xs font-bold uppercase tracking-widest border border-white/[0.05] hover:border-white/[0.15] transition-all duration-300 sm:max-w-40"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-white/[0.85] hover:bg-white text-[#15173d] rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(255,255,255,0.2)] sm:max-w-44"
                  >
                    Save Data
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
