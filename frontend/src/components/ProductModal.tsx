"use client";

import React, { useState } from "react";
import { X, Save, Loader2 } from "lucide-react";

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ProductModal({ isOpen, onClose, onSuccess }: ProductModalProps) {
  const [loading, setLoading] = useState(false);
  
  // State Form
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    price: 0,
    stock: 0,
    catalog_cardcode: "",
    provider: "manual", // Default manual
    is_active: true
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:3001/api/admin/products", { // Route Create Manual
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (!res.ok) throw new Error("Gagal menambah produk");

      onSuccess(); // Refresh tabel
      onClose();   // Tutup modal
    } catch (error) {
      console.error(error);
      alert("Error: Gagal menyimpan data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-[#0F1014] border border-[#262626] w-full max-w-lg rounded-2xl shadow-2xl p-6 relative">
        
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white font-mono tracking-wide">
            Add Manual Product
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 font-mono text-sm">
          
          <div>
            <label className="block text-[#8A9886] mb-1">Product Name</label>
            <input 
              type="text" 
              className="w-full bg-black border border-[#262626] rounded-lg px-4 py-3 text-white focus:border-[#9EFFBA] outline-none"
              placeholder="Ex: Joki Mythic"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[#8A9886] mb-1">SKU / Code</label>
              <input 
                type="text" 
                className="w-full bg-black border border-[#262626] rounded-lg px-4 py-3 text-white focus:border-[#9EFFBA] outline-none"
                placeholder="Ex: JOKI-01"
                value={formData.code}
                onChange={(e) => setFormData({...formData, code: e.target.value})}
                required
              />
            </div>
            
            <div>
              <label className="block text-[#8A9886] mb-1">Catalog (Game)</label>
              <input 
                type="text" 
                className="w-full bg-black border border-[#262626] rounded-lg px-4 py-3 text-white focus:border-[#9EFFBA] outline-none"
                placeholder="Ex: MLBB"
                value={formData.catalog_cardcode}
                onChange={(e) => setFormData({...formData, catalog_cardcode: e.target.value})}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[#8A9886] mb-1">Price (Rp)</label>
              <input 
                type="number" 
                className="w-full bg-black border border-[#262626] rounded-lg px-4 py-3 text-[#9EFFBA] font-bold focus:border-[#9EFFBA] outline-none"
                value={formData.price}
                onChange={(e) => setFormData({...formData, price: parseFloat(e.target.value)})}
                required
              />
            </div>

            <div>
              <label className="block text-[#8A9886] mb-1">Stock</label>
              <input 
                type="number" 
                className="w-full bg-black border border-[#262626] rounded-lg px-4 py-3 text-white focus:border-[#9EFFBA] outline-none"
                value={formData.stock}
                onChange={(e) => setFormData({...formData, stock: parseInt(e.target.value)})}
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full mt-6 bg-[#9EFFBA] hover:bg-[#86e8a3] text-black font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" /> : <><Save size={18} /> Save Product</>}
          </button>

        </form>
      </div>
    </div>
  );
}