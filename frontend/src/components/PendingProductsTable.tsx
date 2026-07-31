'use client'

import React, { useState, useEffect } from 'react'
import { AlertTriangle, CheckCircle, ChevronDown, Loader2, RefreshCw } from 'lucide-react'

// Interfaces menyesuaikan database
interface PendingProduct {
  id: number
  raw_sku: string
  raw_brand: string
  raw_name: string
  provider: string
  status: string
  created_at: string
}

interface Catalog {
  cardcode: string
  name: string
}

export default function PendingProductsTable() {
  const [pendingProducts, setPendingProducts] = useState<PendingProduct[]>([])
  const [catalogs, setCatalogs] = useState<Catalog[]>([])
  const [loading, setLoading] = useState(true)
  
  // Buat nyimpen pilihan dropdown katalog per baris (mapping pending_id -> catalog_cardcode)
  const [selectedMapping, setSelectedMapping] = useState<Record<number, string>>({})
  
  // Buat nampilin loading pas tombol approve diklik per baris
  const [approvingId, setApprovingId] = useState<number | null>(null)

  // Fetch Data (Pending & Catalogs buat dropdown)
  const fetchData = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }
      
      const [resPending, resCat] = await Promise.all([
        fetch('http://localhost:3001/api/admin/products/pending', { headers }),
        fetch('http://localhost:3001/api/admin/catalogs', { headers })
      ])
      
      const pendingData = await resPending.json()
      const catData = await resCat.json()
      
      setPendingProducts(Array.isArray(pendingData) ? pendingData : [])
      setCatalogs(catData.catalogs || catData.data || (Array.isArray(catData) ? catData : []))
    } catch (error) {
      console.error("Gagal load data staging:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Fungsi Action: Approve produk ke tabel utama
  const handleApprove = async (pendingId: number) => {
    const targetCatalog = selectedMapping[pendingId]
    
    if (!targetCatalog) {
      alert("Pilih katalog tujuan dulu cuy!")
      return
    }

    setApprovingId(pendingId)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('http://localhost:3001/api/admin/products/approve', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          pending_id: pendingId,
          catalog_cardcode: targetCatalog
        })
      })

      if (res.ok) {
        // Hapus dari list lokal kalau sukses, biar UX-nya smooth tanpa reload full
        setPendingProducts(prev => prev.filter(p => p.id !== pendingId))
        alert("Sukses! Produk udah live di toko lu.")
      } else {
        const errData = await res.json()
        alert(`Gagal: ${errData.error}`)
      }
    } catch (error) {
      alert("Error jaringan cuy.")
    } finally {
      setApprovingId(null)
    }
  }

  return (
    <div className="w-full bg-white/5 backdrop-blur-xl border border-orange-500/20 rounded-3xl p-6 shadow-[0_0_30px_rgba(249,115,22,0.05)] relative z-10 overflow-hidden mt-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold font-mono text-orange-400 flex items-center gap-2">
            <AlertTriangle size={20} /> Staging Area (Perlu Mapping)
          </h2>
          <p className="text-white/40 text-xs mt-1">Produk baru dari provider yang belum punya rumah di katalog lu.</p>
        </div>
        <button onClick={fetchData} className="p-2 bg-white/5 rounded-xl hover:bg-white/10 text-white/50 hover:text-white transition-all">
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="w-full overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead>
            <tr className="border-b border-white/10">
              <th className="w-[15%] py-4 text-[11px] text-white/40 uppercase font-bold tracking-widest pl-4">RAW SKU</th>
              <th className="w-[30%] text-[11px] text-white/40 uppercase font-bold tracking-widest px-4">PROVIDER BRAND / NAME</th>
              <th className="w-[15%] text-[11px] text-white/40 uppercase font-bold tracking-widest px-4">PROVIDER</th>
              <th className="w-[25%] text-[11px] text-white/40 uppercase font-bold tracking-widest px-4">PILIH KATALOG TUJUAN</th>
              <th className="w-[15%] text-[11px] text-white/40 uppercase font-bold tracking-widest text-right pr-4">ACTION</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="py-10 text-center"><Loader2 className="animate-spin text-orange-500 mx-auto" /></td></tr>
            ) : pendingProducts.length > 0 ? (
              pendingProducts.map((p) => (
                <tr key={p.id} className="border-b border-white/5 hover:bg-orange-500/5 transition-all">
                  <td className="py-4 pl-4 font-mono text-xs text-white/70">{p.raw_sku}</td>
                  <td className="px-4">
                    <p className="font-sans font-bold text-sm text-white/90">{p.raw_brand}</p>
                    <p className="font-mono text-[10px] text-white/40 mt-1">{p.raw_name}</p>
                  </td>
                  <td className="px-4 text-xs text-white/50 uppercase tracking-wider">{p.provider}</td>
                  
                  {/* DROPDOWN PILIH KATALOG */}
                  <td className="px-4">
                    <div className="relative">
                      <select 
                        className="w-full appearance-none bg-black/40 border border-white/10 text-white text-xs px-4 py-2.5 rounded-xl outline-none focus:border-orange-500/50 cursor-pointer"
                        value={selectedMapping[p.id] || ''}
                        onChange={(e) => setSelectedMapping({...selectedMapping, [p.id]: e.target.value})}
                      >
                        <option value="" disabled className="text-white/30">-- Pilih Katalog --</option>
                        {catalogs.map(c => (
                          <option key={c.cardcode} value={c.cardcode} className="bg-gray-900 text-white">
                            {c.name} ({c.cardcode})
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-3 text-white/40 pointer-events-none" />
                    </div>
                  </td>

                  {/* ACTION BUTTON */}
                  <td className="pr-4 text-right">
                    <button 
                      onClick={() => handleApprove(p.id)}
                      disabled={!selectedMapping[p.id] || approvingId === p.id}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ml-auto
                        ${!selectedMapping[p.id] 
                          ? 'bg-white/5 text-white/30 cursor-not-allowed' 
                          : 'bg-orange-500 hover:bg-orange-600 text-white shadow-[0_0_15px_rgba(249,115,22,0.4)]'
                        }`}
                    >
                      {approvingId === p.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                      Approve
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="py-20 text-center text-white/40 font-mono text-sm">
                  <CheckCircle size={40} className="mx-auto mb-4 text-emerald-500/50" />
                  Database bersih cuy! Tidak ada produk yang nyangkut.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}