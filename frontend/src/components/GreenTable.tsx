'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  SquarePen,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Image as ImageIcon,
  RefreshCw,
  Zap,
  Clock,
  Gamepad2
} from 'lucide-react'
import GreenTabs from './GreenTabs'

interface Product {
  ID: number
  name: string
  code: string
  price: number
  stock: number
  is_active: boolean
  provider?: string
  image_url?: string
  updated_at?: string
  catalog_cardcode?: string
  catalog?: {
    name: string
    slug: string
    cardcode?: string
  }
}

interface Catalog {
  name: string
  cardcode: string
}

export default function GreenTable () {
  const [products, setProducts] = useState<Product[]>([])
  const [catalogs, setCatalogs] = useState<Catalog[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('Semua')
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const [cooldown, setCooldown] = useState(0)
  const [lastSync, setLastSync] = useState<string>('-')
  const [isSyncing, setIsSyncing] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [newImageUrl, setNewImageUrl] = useState('')

  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const handleUpdateImage = async () => {
    if (!editingProduct) return
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(
        `http://localhost:3001/api/admin/products/${editingProduct.ID}/image`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ image_url: newImageUrl })
        }
      )
      if (res.ok) {
        alert('Gambar item berhasil diupdate! 📸')
        setEditingProduct(null)
        fetchAllData()
      } else {
        alert('Gagal update gambar di server')
      }
    } catch (error) {
      alert('Error: ' + error)
    }
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const updateLastSyncTime = () => {
    if (typeof window !== 'undefined') {
      const storedTime = localStorage.getItem('lastSyncTime')
      if (storedTime) {
        const date = new Date(parseInt(storedTime))
        setLastSync(
          date.toLocaleString('id-ID', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
          })
        )
        const secondsPassed = Math.floor(
          (Date.now() - parseInt(storedTime)) / 1000
        )
        const remaining = 300 - secondsPassed
        if (remaining > 0) setCooldown(remaining)
      } else {
        setLastSync('Belum pernah')
      }
    }
  }

  useEffect(() => {
    updateLastSyncTime()
    const interval = setInterval(() => {
      setCooldown(prev => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const fetchAllData = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        window.location.href = '/login'
        return
      }
      const headers = { Authorization: `Bearer ${token}` }
      const resCat = await fetch('http://localhost:3001/api/admin/catalogs', {
        headers
      })
      const dataCat = await resCat.json()
      setCatalogs(dataCat.data || (Array.isArray(dataCat) ? dataCat : []))
      const resProd = await fetch('http://localhost:3001/api/products', {
        headers
      })
      const dataProd = await resProd.json()
      if (resProd.ok) {
        setProducts(dataProd.products || [])
        if (dataProd.last_update) {
          const date = new Date(dataProd.last_update)
          setLastSync(
            date.toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit' })
          )
        }
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAllData()
    const autoRefresh = setInterval(fetchAllData, 120000)
    return () => clearInterval(autoRefresh)
  }, [])

  const handleSync = async (providerName: string = 'digiflazz') => {
    if (cooldown > 0 || isSyncing) return
    setIsSyncing(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(
        `http://localhost:3001/api/admin/products/sync/${providerName}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          }
        }
      )
      const data = await res.json()
      if (res.ok) {
        localStorage.setItem('lastSyncTime', Date.now().toString())
        updateLastSyncTime()
        setCooldown(300)
        await fetchAllData()
        alert(data.message)
      } else {
        throw new Error(data.message || 'Gagal Sync')
      }
    } catch (error: any) {
      alert('Gagal Sync: ' + error.message)
    } finally {
      setIsSyncing(false)
    }
  }

  const dynamicTabs = useMemo(() => {
    const base = [{ id: 'Semua', label: 'Semua' }]
    return [
      ...base,
      ...catalogs.map(cat => ({ id: cat.cardcode, label: cat.name }))
    ]
  }, [catalogs])

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const prodCode = p.catalog_cardcode || p.catalog?.cardcode || ''
      const matchesTab =
        activeTab === 'Semua'
          ? true
          : prodCode.toLowerCase() === activeTab.toLowerCase()
      const matchesSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.code.toLowerCase().includes(searchTerm.toLowerCase())
      return matchesTab && matchesSearch
    })
  }, [products, activeTab, searchTerm])

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage)
  const currentItems = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page)
  }
  const formatRupiah = (price: number) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(price)

  const renderPaginationNumbers = () => {
    const pages = []
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      let start = Math.max(2, currentPage - 1),
        end = Math.min(totalPages - 1, currentPage + 1)
      if (currentPage <= 2) end = 3
      if (currentPage >= totalPages - 1) start = totalPages - 2
      if (start > 2) pages.push('...')
      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i)
      }
      if (end < totalPages - 1) pages.push('...')
      if (!pages.includes(totalPages)) pages.push(totalPages)
    }
    return pages.map((page, index) => (
      <div
        key={index}
        onClick={() => typeof page === 'number' && handlePageChange(page)}
        className={
          page === '...'
            ? 'h-8 flex items-end justify-center text-[#707170] select-none pb-2 font-sans tracking-tighter px-0.5'
            : currentPage === page
            ? 'aj-page-active cursor-pointer'
            : 'aj-page-link cursor-pointer'
        }
      >
        {page}
      </div>
    ))
  }

  return (
    <div className='w-full relative font-sans text-sm mt-8 pb-10'>
      {/* 1. CONTROLLER SECTION (Layout Asli Lu) */}
      <div className='flex flex-col md:flex-row md:items-end justify-between relative z-20 gap-4 px-8 mb-[-1px] overflow-visible'>
        <div className='flex-1 relative overflow-visible'>
          <GreenTabs
            tabs={dynamicTabs}
            activeTab={activeTab}
            onChange={tabId => {
              setActiveTab(tabId)
              setCurrentPage(1)
            }}
          />
        </div>

        <div className='flex items-center gap-2 mb-2'>
          <div className='hidden lg:flex flex-col items-end mr-1 text-[10px] text-gray-500 font-mono leading-tight'>
            <span className='flex items-center gap-1'>
              <Clock size={10} /> Last Sync:
            </span>
            <span className='text-[#9EFFBA] font-bold'>{lastSync}</span>
          </div>

          <div className='relative' ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              disabled={isSyncing || cooldown > 0}
              className={`w-10 h-10 flex items-center justify-center rounded-full border transition-all duration-300 shadow-lg ${
                isDropdownOpen || isSyncing
                  ? 'border-[#9EFFBA] bg-[#9EFFBA]/10 text-[#9EFFBA]'
                  : 'bg-black border-[#707170] text-[#707170] hover:border-white'
              }`}
            >
              {isSyncing ? (
                <Loader2 size={18} className='animate-spin' />
              ) : (
                <Zap
                  size={18}
                  className={isDropdownOpen ? 'fill-current' : ''}
                />
              )}
              {cooldown > 0 && !isSyncing && (
                <span className='absolute -top-1 -right-1 text-[9px] bg-red-500 text-white w-4 h-4 flex items-center justify-center rounded-full font-bold border border-black'>
                  {Math.ceil(cooldown / 60)}m
                </span>
              )}
            </button>
            <AnimatePresence>
              {isDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 5, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className='absolute right-0 mt-2 w-56 bg-[#0D0D0D] border border-[#707170] rounded-xl shadow-2xl z-[100] overflow-hidden'
                >
                  <div className='p-1.5 flex flex-col gap-1'>
                    <p className='text-[10px] text-[#555] font-mono px-3 py-1.5 uppercase tracking-widest font-bold'>
                      Select Provider
                    </p>
                    <button
                      onClick={() => {
                        handleSync('all')
                        setIsDropdownOpen(false)
                      }}
                      className='w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#9EFFBA] hover:bg-[#9EFFBA]/10 transition-all font-bold'
                    >
                      <RefreshCw size={14} />
                      <span>Sync All Provider</span>
                    </button>
                    <button
                      onClick={() => {
                        handleSync('digiflazz')
                        setIsDropdownOpen(false)
                      }}
                      className='w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#8A9886] hover:bg-[#9EFFBA]/10 group transition-all'
                    >
                      <Zap size={14} />
                      <span>Digiflazz</span>
                    </button>
                    <button
                      onClick={() => {
                        handleSync('apigames')
                        setIsDropdownOpen(false)
                      }}
                      className='w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#8A9886] hover:bg-[#9EFFBA]/10 group transition-all'
                    >
                      <Gamepad2 size={14} />
                      <span>ApiGames</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={fetchAllData}
            className='w-10 h-10 rounded-full bg-black border border-[#707170] text-[#707170] hover:text-white transition-all shadow-lg flex items-center justify-center'
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <div className='hidden md:flex items-center gap-2 px-4 py-2 bg-black border-[0.5px] border-[#707170] rounded-full w-[245px] h-[40px] shadow-lg flex-shrink-0 z-30'>
            <input
              type='text'
              placeholder='Cari Nama / SKU...'
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value)
                setCurrentPage(1)
              }}
              className='bg-transparent text-white text-[15px] w-full focus:outline-none placeholder:text-[#555]'
            />
            <Search size={16} className='text-white' />
          </div>
        </div>
      </div>

      {/* 2. 🔥 FIGMA TABLE CONTENT (Group 43 & Rectangle 18) */}
      <div className='w-full bg-[#000000] rounded-none relative z-10 flex flex-col'>
        <div className='w-full flex flex-col px-8 pt-6 pb-8'>
          <div className='w-full bg-[#0D0D0D] border-[0.5px] border-[#707170] rounded-[15px] flex flex-col relative min-h-[503px] overflow-hidden shadow-2xl'>
            {loading && products.length === 0 ? (
              <div className='flex-1 flex items-center justify-center text-[#9EFFBA]'>
                <Loader2 className='animate-spin w-10 h-10' />
              </div>
            ) : (
              <>
                <div className='px-8 pt-0 pb-4 overflow-x-auto'>
                  <table className='w-full text-left border-collapse table-fixed'>
                    <thead>
                      <tr className='h-[70px]'>
                        {/* Tinggi header ditambah biar lega */}
                        <th className="pl-14 w-[120px] font-['IBM_Plex_Mono'] text-[14px] text-[#8A9886] font-normal uppercase">
                          IMAGE
                        </th>
                        <th className="font-['IBM_Plex_Mono'] text-[14px] text-[#8A9886] font-normal uppercase w-[30%] px-6">
                          PRODUCT NAME
                        </th>
                        <th className="font-['IBM_Plex_Mono'] text-[14px] text-[#8A9886] font-normal uppercase w-[15%] px-6">
                          PROVIDER
                        </th>
                        <th className="font-['IBM_Plex_Mono'] text-[14px] text-[#8A9886] font-normal uppercase w-[15%] px-6">
                          SKU CODE
                        </th>
                        <th className="font-['IBM_Plex_Mono'] text-[14px] text-[#8A9886] font-normal uppercase w-[15%] px-6 text-right">
                          PRICE
                        </th>
                        <th className="font-['IBM_Plex_Mono'] text-[14px] text-[#8A9886] font-normal uppercase w-[10%] text-center">
                          STOK
                        </th>
                        <th className="font-['IBM_Plex_Mono'] text-[14px] text-[#8A9886] font-normal uppercase pr-14 text-center">
                          STATUS
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentItems.map((item, index) => (
                        <tr
                          key={item.ID}
                          className={`h-[85px] hover:bg-white/[0.01] transition-all group ${
                            index === 0
                              ? 'border-t-0'
                              : 'border-t border-[#707170]/30'
                          }`}
                        >
                          <td className='pl-14 align-middle'>
                            <div className='flex items-center h-full'>
                              <div
                                className='w-[52px] h-[52px] bg-[#D9D9D9] rounded-[8px] overflow-hidden relative group/thumb cursor-pointer'
                                onClick={() => {
                                  setEditingProduct(item)
                                  setNewImageUrl(item.image_url || '')
                                }}
                              >
                                {item.image_url ? (
                                  <img
                                    src={item.image_url}
                                    className='w-full h-full object-cover'
                                    alt=''
                                  />
                                ) : (
                                  <div className='w-full h-full flex items-center justify-center'>
                                    <ImageIcon
                                      size={18}
                                      className='text-gray-400'
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className='px-6 align-middle'>
                            <div className='flex flex-col justify-center'>
                              {/* PRODUCT NAME: font-semibold -> font-medium, 15px -> 14px */}
                              <span className="font-['Inter'] font-medium text-[14px] text-white leading-tight">
                                {item.name}
                              </span>
                              <span className="font-['Anonymous_Pro'] text-[11px] text-[#9EFFBA] mt-1 uppercase">
                                {item.catalog_cardcode ||
                                  item.catalog?.cardcode ||
                                  '-'}
                              </span>
                            </div>
                          </td>

                          {/* PROVIDER: font-medium -> font-normal, 14px -> 13px */}
                          <td className="font-['Inter'] font-normal text-[13px] text-white uppercase px-6 align-middle">
                            {item.provider || 'DIGIFLAZZ'}
                          </td>

                          {/* SKU CODE: 13px -> 12px */}
                          <td className="font-['IBM_Plex_Mono'] text-[13px] font-medium text-[#9EFFBA] uppercase px-6 align-middle tracking-wider">
                            {item.code || '-'}
                          </td>

                          {/* PRICE: font-semibold -> font-medium, 15px -> 14px */}
                          <td className="font-['Inter'] font-medium text-[14px] text-[#3DF06F] px-6 text-right align-middle">
                            {formatRupiah(item.price)}
                          </td>

                          <td className='text-center align-middle'>
                            <div className='flex items-center justify-center h-full'>
                              {item.stock === 0 && item.is_active ? (
                                <span className="font-['Minecraftia'] text-[16px] text-[#9EFFBA] inline-block transform -rotate-90 select-none">
                                  8
                                </span>
                              ) : item.stock === 0 && !item.is_active ? (
                                <span className="font-['IBM_Plex_Mono'] font-bold text-[13px] text-[#FF0000] uppercase tracking-tighter">
                                  KOSONG
                                </span>
                              ) : (
                                <span className="font-['IBM_Plex_Mono'] font-normal text-[14px] text-white">
                                  {item.stock}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className='pr-14 align-middle'>
                            <div className='flex justify-center'>
                              {/* STATUS: Kecilkan padding & font size */}
                              {item.is_active ? (
                                <div className="px-5 min-w-[85px] h-[32px] bg-[#9EFFBA] shadow-[0px_0px_4px_#9EFFBA] rounded-full flex items-center justify-center font-['IBM_Plex_Mono'] font-bold text-[12px] text-[#0D0D0D]">
                                  ONLINE
                                </div>
                              ) : (
                                <div className="px-5 min-w-[95px] h-[32px] bg-[#0D0D0D] border border-[#262626] rounded-full flex items-center justify-center font-['IBM_Plex_Mono'] font-bold text-[12px] text-[#8A9886]">
                                  OFFLINE
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 3. PAGINATION SECTION (Layout Asli Lu) */}
                <div className='mt-auto h-[60px] flex items-center justify-between px-10'>
                  <span className="font-['Anonymous_Pro'] text-[15px] text-white">
                    Showing {(currentPage - 1) * itemsPerPage + 1}-
                    {Math.min(
                      currentPage * itemsPerPage,
                      filteredProducts.length
                    )}{' '}
                    of {filteredProducts.length}
                  </span>
                  <div className='aj-pagination-box flex items-center gap-1'>
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className='aj-page-arrow-slot'
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <div className='aj-pagination-numbers flex gap-1'>
                      {renderPaginationNumbers()}
                    </div>
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className='aj-page-arrow-slot'
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 4. MODAL SECTION (Layout Asli Lu) */}
      <AnimatePresence>
        {editingProduct && (
          <div className='fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4'>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className='w-full max-w-md bg-[#0D0D0D] border border-[#707170] p-6 rounded-2xl shadow-2xl'
            >
              <h3 className='text-white font-bold mb-1'>Edit Thumbnail Item</h3>
              <p className='text-xs text-gray-500 mb-4'>
                {editingProduct.name}
              </p>
              <div className='mb-4 aspect-video rounded-xl bg-[#1a1a1a] overflow-hidden border border-[#333] flex items-center justify-center'>
                {newImageUrl ? (
                  <img
                    src={newImageUrl}
                    className='w-full h-full object-cover'
                    alt=''
                  />
                ) : (
                  <ImageIcon size={32} className='text-gray-800' />
                )}
              </div>
              <input
                type='text'
                value={newImageUrl}
                onChange={e => setNewImageUrl(e.target.value)}
                placeholder='Paste image URL...'
                className='w-full bg-black border border-[#333] rounded-lg p-3 text-white text-sm focus:border-[#9EFFBA] outline-none transition-all mb-6 font-sans'
              />
              <div className='flex gap-3'>
                <button
                  onClick={() => setEditingProduct(null)}
                  className='flex-1 py-2 text-sm text-gray-500 hover:text-white transition-colors'
                >
                  Batal
                </button>
                <button
                  onClick={handleUpdateImage}
                  className='flex-1 py-2 bg-[#9EFFBA] text-black rounded-lg text-sm font-bold hover:shadow-[0_0_15px_#9EFFBA] transition-all'
                >
                  Simpan Gambar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
