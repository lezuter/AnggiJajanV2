"use client";

import React, { useState } from "react";
import { X, Save, Loader2 } from "lucide-react";
import { useApi } from "@/hooks/useApi"; // 🔥 IMPORT HOOK API

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ProductModal({
  isOpen,
  onClose,
  onSuccess,
}: ProductModalProps) {
  const api = useApi(); // 🔥 INISIALISASI
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    price: 0,
    stock: 0,
    catalog_cardcode: "",
    provider: "manual",
    is_active: true,
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 🔥 PANGGIL API POST LEWAT WRAPPER
      const res = await api.post("/admin/products", formData);

      if (!res.ok) throw new Error("Gagal menambah produk");

      onSuccess();
      onClose();
    } catch (error) {
      alert("Gagal menyimpan data!");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      ></div>
      <div className="relative bg-[#0F0F0F] border border-[#262626] rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-[#262626] flex items-center justify-between">
          <h2 className="text-xl font-bold text-white font-mono">
            Create New Node
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-[#8A9886] hover:text-white transition-colors bg-[#1A1A1A] rounded-xl"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-[#8A9886] mb-1">Product Name</label>
            <input
              type="text"
              className="w-full bg-black border border-[#262626] rounded-lg px-4 py-3 text-white focus:border-[#9EFFBA] outline-none"
              placeholder="Ex: 500 Diamonds"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              required
            />
          </div>

          <div>
            <label className="block text-[#8A9886] mb-1">SKU / Code</label>
            <input
              type="text"
              className="w-full bg-black border border-[#262626] rounded-lg px-4 py-3 text-white focus:border-[#9EFFBA] outline-none font-mono"
              placeholder="Ex: MLBB_500"
              value={formData.code}
              onChange={(e) =>
                setFormData({ ...formData, code: e.target.value })
              }
              required
            />
          </div>

          <div>
            <label className="block text-[#8A9886] mb-1">
              Catalog Card Code
            </label>
            <input
              type="text"
              className="w-full bg-black border border-[#262626] rounded-lg px-4 py-3 text-white focus:border-[#9EFFBA] outline-none font-mono uppercase"
              placeholder="Ex: MLBB"
              value={formData.catalog_cardcode}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  catalog_cardcode: e.target.value.toUpperCase(),
                })
              }
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[#8A9886] mb-1">Price (Rp)</label>
              <input
                type="number"
                className="w-full bg-black border border-[#262626] rounded-lg px-4 py-3 text-[#9EFFBA] font-bold focus:border-[#9EFFBA] outline-none"
                value={formData.price}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    price: parseFloat(e.target.value),
                  })
                }
                required
              />
            </div>

            <div>
              <label className="block text-[#8A9886] mb-1">Stock</label>
              <input
                type="number"
                className="w-full bg-black border border-[#262626] rounded-lg px-4 py-3 text-white focus:border-[#9EFFBA] outline-none"
                value={formData.stock}
                onChange={(e) =>
                  setFormData({ ...formData, stock: parseInt(e.target.value) })
                }
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 bg-[#9EFFBA] hover:bg-[#86e8a3] text-black font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <Save size={20} />
            )}
            {loading ? "Menyimpan..." : "Simpan Produk"}
          </button>
        </form>
      </div>
    </div>
  );
}
