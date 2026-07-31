'use client'

import {
  type FormEvent,
  type ReactNode,
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef
} from 'react'
import {
  Search, Package, AlertTriangle, TrendingUp,
  Edit, Gamepad2, Smartphone,
  Zap, Wallet, Loader2, RefreshCw, ListChecks,
  Power, PowerOff, MoveRight, X, Info
} from 'lucide-react'

// 🔥 1. IMPORT SATPAM 401
import { useApi } from '@/hooks/useApi'
import PendingProductsTable from '@/components/PendingProductsTable'
import { getProductSellingPrice } from '@/lib/pricing'

// ==========================================
// INTERFACES & CONSTANTS
// ==========================================
interface Catalog {
  id?: number | string;
  name: string;
  cardcode: string;
  category_id?: string | number;
}

interface Product {
  ID: number;
  name: string;
  code: string;
  price: number;
  selling_price?: number;
  stock: number;
  is_active: boolean;
  admin_enabled: boolean;
  provider?: string;
  catalog_cardcode?: string;
  catalog?: Catalog;
  image_url?: string;
  original_price?: number | null;
}

interface ProductEditForm {
  image_url: string;
  original_price: string;
}

type BulkDialog = 'edit' | 'status' | 'move' | null

interface BulkEditForm {
  applyStatus: boolean;
  adminEnabled: boolean;
  applyCatalog: boolean;
  catalogCardCode: string;
  applyImage: boolean;
  imageUrl: string;
}

interface BulkMutationResult {
  requested: number;
  matched: number;
  updated?: number;
  error?: string;
}

interface BulkAllowedChanges {
  admin_enabled?: boolean;
  catalog_cardcode?: string;
  image_url?: string;
}

interface BulkFeedback {
  type: 'success' | 'error';
  message: string;
}

const disabledBulkFields = [
  ['Product ID', 'Primary key unik dan tidak boleh diubah.'],
  ['SKU / Product Code', 'SKU unik dan terkait provider.'],
  ['Nama produk', 'Setiap produk memiliki nama berbeda dan dapat diperbarui provider.'],
  ['Harga final', 'Harga setiap SKU berbeda dan tidak aman disamakan.'],
  ['Harga normal / harga coret', 'Nilai diskon harus diatur per produk.'],
  ['Harga modal', 'Berasal dari provider dan berbeda per SKU.'],
  ['Status provider', 'Dikelola otomatis oleh sinkronisasi provider.'],
  ['Provider', 'Provider merupakan bagian dari sumber dan routing transaksi.'],
  ['Stock', 'Stock provider berbeda dan dapat ditimpa saat sinkronisasi.']
] as const

const initialBulkEditForm: BulkEditForm = {
  applyStatus: false,
  adminEnabled: true,
  applyCatalog: false,
  catalogCardCode: '',
  applyImage: false,
  imageUrl: ''
}

function isValidBulkImageURL(imageUrl: string) {
  if (imageUrl.startsWith('/') && !imageUrl.startsWith('//')) return true

  try {
    const parsedUrl = new URL(imageUrl)
    return (
      (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') &&
      Boolean(parsedUrl.host)
    )
  } catch {
    return false
  }
}

const mainCategories = [
  { id: 'all', name: 'Semua', icon: Package },
  { id: 'games', name: 'Games', icon: Gamepad2 },
  { id: 'pulsa', name: 'Pulsa & Data', icon: Smartphone },
  { id: 'emoney', name: 'E-Money', icon: Wallet },
  { id: 'pln', name: 'Token PLN', icon: Zap },
]

function SelectionCheckbox({
  checked,
  indeterminate = false,
  disabled = false,
  label,
  onChange
}: {
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  label: string;
  onChange: () => void;
}) {
  const checkboxRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = indeterminate
    }
  }, [indeterminate])

  return (
    <input
      ref={checkboxRef}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      aria-label={label}
      onChange={onChange}
      className="h-5 w-5 cursor-pointer rounded border-white/20 bg-black/20 accent-[#0084FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0084FF]/70 disabled:cursor-not-allowed disabled:opacity-30"
    />
  )
}

function BulkModal({
  title,
  description,
  titleId,
  children,
  onClose,
  isBusy = false,
  wide = false
}: {
  title: string;
  description: string;
  titleId: string;
  children: ReactNode;
  onClose: () => void;
  isBusy?: boolean;
  wide?: boolean;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6"
    >
      <button
        type="button"
        aria-label="Tutup dialog"
        disabled={isBusy}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm disabled:cursor-wait"
      />

      <div className={`relative z-10 max-h-[calc(100dvh-2rem)] w-full overflow-y-auto rounded-3xl border border-white/10 bg-[#090b12] p-6 shadow-[0_32px_100px_rgba(0,0,0,0.65)] sm:p-8 ${wide ? 'max-w-4xl' : 'max-w-xl'}`}>
        <div className="flex items-start justify-between gap-5">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#0084FF]">
              Bulk product tools
            </p>
            <h2 id={titleId} className="mt-2 text-2xl font-semibold text-white">
              {title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/45">
              {description}
            </p>
          </div>

          <button
            type="button"
            autoFocus
            disabled={isBusy}
            onClick={onClose}
            aria-label="Tutup dialog"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 text-white/45 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0084FF]/70 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X size={17} />
          </button>
        </div>

        {children}
      </div>
    </div>
  )
}

function BulkFeedbackBanner({
  feedback,
  onDismiss
}: {
  feedback: BulkFeedback;
  onDismiss?: () => void;
}) {
  const isSuccess = feedback.type === 'success'

  return (
    <div
      role={isSuccess ? 'status' : 'alert'}
      className={`flex items-start justify-between gap-4 rounded-2xl border px-4 py-3 text-sm ${
        isSuccess
          ? 'border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-100'
          : 'border-red-400/20 bg-red-400/[0.08] text-red-100'
      }`}
    >
      <p className="leading-6">{feedback.message}</p>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Tutup notifikasi"
          className="mt-0.5 shrink-0 rounded-full p-1 text-current/60 transition-colors hover:bg-white/10 hover:text-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}

function ProductTableThumbnail({
  imageUrl,
  productName
}: {
  imageUrl?: string;
  productName: string;
}) {
  const normalizedUrl = imageUrl?.trim() || ''
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const hasFailed = failedUrl === normalizedUrl

  return (
    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-1.5 transition-transform group-hover:scale-105">
      {normalizedUrl && !hasFailed ? (
        // URL thumbnail berasal dari database, sehingga elemen img sengaja dipakai.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={normalizedUrl}
          alt={`Thumbnail ${productName}`}
          loading="lazy"
          decoding="async"
          onError={() => setFailedUrl(normalizedUrl)}
          className="h-full w-full object-contain"
        />
      ) : (
        <Package aria-hidden="true" size={20} className="text-white/20" />
      )}
    </div>
  )
}

export default function ProductsPage() {
  // 🔥 2. PANGGIL METHOD GET & POST DARI HOOK LU
  const { get, post, put, patch } = useApi()

  // ==========================================
  // STATE MANAGEMENT
  // ==========================================
  const [activeTab, setActiveTab] = useState<'live' | 'pending'>('live')

  const [products, setProducts] = useState<Product[]>([])
  const [catalogs, setCatalogs] = useState<Catalog[]>([])

  const [loading, setLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)

  const [activeCategory, setActiveCategory] = useState('all')
  const [activeCatalog, setActiveCatalog] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedItems, setSelectedItems] = useState<number[]>([])
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [editForm, setEditForm] = useState<ProductEditForm>({
    image_url: '',
    original_price: ''
  })
  const [isSavingProduct, setIsSavingProduct] = useState(false)
  const [thumbnailPreviewError, setThumbnailPreviewError] = useState(false)
  const [bulkDialog, setBulkDialog] = useState<BulkDialog>(null)
  const [bulkEditForm, setBulkEditForm] = useState<BulkEditForm>(
    initialBulkEditForm
  )
  const [pendingBulkStatus, setPendingBulkStatus] = useState(true)
  const [moveCatalogCardCode, setMoveCatalogCardCode] = useState('')
  const [isBulkActionLoading, setIsBulkActionLoading] = useState(false)
  const bulkActionLockRef = useRef(false)
  const [bulkFeedback, setBulkFeedback] = useState<BulkFeedback | null>(null)

  // ==========================================
  // FETCH DATA & SYNC (SUDAH BERSIH DARI TOKEN MANUAL)
  // ==========================================
  const fetchAllData = useCallback(async () => {
    setLoading(true)
    try {
      // Tinggal panggil endpoint-nya!
      const [resCat, resProd] = await Promise.all([
        get('/admin/catalogs'),
        get('/products')
      ])

      const dataCat = await resCat.json()
      const dataProd = await resProd.json()

      const fetchedCatalogs: Catalog[] = dataCat.catalogs || dataCat.data || (Array.isArray(dataCat) ? dataCat : [])
      const fetchedProducts: Product[] = dataProd.products || dataProd.data || (Array.isArray(dataProd) ? dataProd : [])

      setCatalogs(fetchedCatalogs)
      setProducts(fetchedProducts)
      const validProductIDs = new Set(
        fetchedProducts.map(product => product.ID)
      )
      setSelectedItems(currentItems =>
        currentItems.filter(productID => validProductIDs.has(productID))
      )
    } catch (error) {
      console.error("Gagal load data dari DB:", error)
    } finally {
      setLoading(false)
    }
  }, [get]) // Masukin get ke dependency array

  useEffect(() => {
    fetchAllData()
  }, [fetchAllData])

  const handleSyncAPI = async (provider = 'all') => {
    setIsSyncing(true)
    try {
      // Langsung tembak POST, token & URL udah diurusin useApi.
      // Kirim body kosong {} karena post di useApi lu butuh argumen ke-2.
      const res = await post(`/admin/products/sync/${provider}`, {})

      if (res.ok) {
        await fetchAllData()
        alert(`Sinkronisasi produk (${provider}) berhasil!`)
      } else {
        const errorData = await res.json()
        alert(`Gagal sinkronisasi: ${errorData.error || 'Server error'}`)
      }
    } catch (error) {
      console.error("Error pas sync:", error)
      alert('Terjadi kesalahan jaringan saat Sync.')
    } finally {
      setIsSyncing(false)
    }
  }

  const openProductEditor = (product: Product) => {
    setBulkDialog(null)
    setEditingProduct(product)
    setEditForm({
      image_url: product.image_url || '',
      original_price:
        product.original_price === null ||
        product.original_price === undefined
          ? ''
          : String(product.original_price)
    })
    setThumbnailPreviewError(false)
  }

  const closeProductEditor = () => {
    if (isSavingProduct) return

    setEditingProduct(null)
    setThumbnailPreviewError(false)
  }

  const handleProductUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingProduct) return

    const normalizedOriginalPrice = editForm.original_price.trim()
    const originalPrice =
      normalizedOriginalPrice === ''
        ? null
        : Number(normalizedOriginalPrice)

    if (
      originalPrice !== null &&
      (!Number.isFinite(originalPrice) || originalPrice < 0)
    ) {
      alert('Harga normal harus berupa angka nol atau lebih besar.')
      return
    }

    setIsSavingProduct(true)

    try {
      const response = await put(`/admin/products/${editingProduct.ID}`, {
        image_url: editForm.image_url.trim(),
        original_price: originalPrice
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Gagal memperbarui produk.')
      }

      const updatedProduct = result as Product
      setProducts(currentProducts =>
        currentProducts.map(product =>
          product.ID === editingProduct.ID
            ? { ...product, ...updatedProduct }
            : product
        )
      )
      setEditingProduct(null)
      setThumbnailPreviewError(false)
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : 'Gagal memperbarui produk.'
      )
    } finally {
      setIsSavingProduct(false)
    }
  }

  // ==========================================
  // LOGIC & FILTERING
  // ==========================================
  const availableCatalogs = useMemo(() => {
    if (activeCategory === 'all') return catalogs
    return catalogs.filter(cat => {
       if (!cat.category_id) return true;
       return String(cat.category_id) === activeCategory || String(cat.category_id).toLowerCase().includes(activeCategory)
    })
  }, [catalogs, activeCategory])

  const handleCategoryChange = (catId: string) => {
    setActiveCategory(catId)
    setActiveCatalog('all')
  }

  const displayedProducts = useMemo(() => {
    return products.filter(p => {
      const pCatalogCode = p.catalog_cardcode || p.catalog?.cardcode || ''
      const catalogInfo = catalogs.find(c => c.cardcode === pCatalogCode)

      const matchCategory = activeCategory === 'all' || catalogInfo?.category_id === activeCategory || !catalogInfo?.category_id
      const matchCatalog = activeCatalog === 'all' || pCatalogCode === activeCatalog
      const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (p.code && p.code.toLowerCase().includes(searchTerm.toLowerCase()))

      return matchCategory && matchCatalog && matchSearch
    })
  }, [products, catalogs, activeCategory, activeCatalog, searchTerm])

  const displayedProductIDs = useMemo(
    () => displayedProducts.map(product => product.ID),
    [displayedProducts]
  )
  const selectedItemSet = useMemo(
    () => new Set(selectedItems),
    [selectedItems]
  )
  const displayedSelectedCount = displayedProductIDs.filter(productID =>
    selectedItemSet.has(productID)
  ).length
  const allDisplayedSelected =
    displayedProductIDs.length > 0 &&
    displayedSelectedCount === displayedProductIDs.length
  const someDisplayedSelected =
    displayedSelectedCount > 0 && !allDisplayedSelected

  const toggleAllDisplayedProducts = () => {
    setSelectedItems(currentItems => {
      const currentItemSet = new Set(currentItems)
      const areAllDisplayedSelected = displayedProductIDs.every(productID =>
        currentItemSet.has(productID)
      )

      if (areAllDisplayedSelected) {
        const displayedIDSet = new Set(displayedProductIDs)
        return currentItems.filter(productID => !displayedIDSet.has(productID))
      }

      displayedProductIDs.forEach(productID => currentItemSet.add(productID))
      return Array.from(currentItemSet)
    })
  }

  const toggleProductSelection = (productID: number) => {
    setSelectedItems(currentItems =>
      currentItems.includes(productID)
        ? currentItems.filter(currentID => currentID !== productID)
        : [...currentItems, productID]
    )
  }

  const closeBulkDialog = () => {
    if (isBulkActionLoading) return
    setBulkDialog(null)
  }

  const showBulkStatusDialog = (adminEnabled: boolean) => {
    setEditingProduct(null)
    setPendingBulkStatus(adminEnabled)
    setBulkFeedback(null)
    setBulkDialog('status')
  }

  const showBulkEditDialog = () => {
    setEditingProduct(null)
    setBulkEditForm(initialBulkEditForm)
    setBulkFeedback(null)
    setBulkDialog('edit')
  }

  const showMoveCatalogDialog = () => {
    setEditingProduct(null)
    setMoveCatalogCardCode('')
    setBulkFeedback(null)
    setBulkDialog('move')
  }

  const executeBulkUpdate = async (changes: BulkAllowedChanges) => {
    if (bulkActionLockRef.current || selectedItems.length === 0) return

    bulkActionLockRef.current = true
    setIsBulkActionLoading(true)
    setBulkFeedback(null)

    try {
      const response = await patch('/admin/products/bulk', {
        product_ids: selectedItems,
        changes
      })
      const result = (await response.json()) as BulkMutationResult

      if (!response.ok) {
        throw new Error(result.error || 'Bulk update produk gagal.')
      }

      const missingCount = Math.max(0, result.requested - result.matched)
      const updatedCount = result.updated ?? result.matched
      setBulkFeedback({
        type: 'success',
        message: missingCount > 0
          ? `${updatedCount} produk diperbarui; ${missingCount} produk tidak ditemukan.`
          : `${updatedCount} produk berhasil diperbarui.`
      })
      setBulkDialog(null)
      setSelectedItems([])
      await fetchAllData()
    } catch (error) {
      setBulkFeedback({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Bulk update produk gagal.'
      })
    } finally {
      bulkActionLockRef.current = false
      setIsBulkActionLoading(false)
    }
  }

  const handleBulkEditSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const changes: BulkAllowedChanges = {}
    if (bulkEditForm.applyStatus) {
      changes.admin_enabled = bulkEditForm.adminEnabled
    }
    if (bulkEditForm.applyCatalog) {
      const catalogCardCode = bulkEditForm.catalogCardCode.trim()
      if (!catalogCardCode) {
        setBulkFeedback({
          type: 'error',
          message: 'Pilih katalog tujuan sebelum menyimpan.'
        })
        return
      }
      changes.catalog_cardcode = catalogCardCode
    }
    if (bulkEditForm.applyImage) {
      const imageUrl = bulkEditForm.imageUrl.trim()
      if (!isValidBulkImageURL(imageUrl)) {
        setBulkFeedback({
          type: 'error',
          message: 'Thumbnail harus berupa URL mentah http(s) atau path lokal /images/...'
        })
        return
      }
      changes.image_url = imageUrl
    }
    if (Object.keys(changes).length === 0) {
      setBulkFeedback({
        type: 'error',
        message: 'Aktifkan minimal satu perubahan yang ingin diterapkan.'
      })
      return
    }

    await executeBulkUpdate(changes)
  }

  const handleMoveCatalog = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const catalogCardCode = moveCatalogCardCode.trim()
    if (!catalogCardCode) {
      setBulkFeedback({
        type: 'error',
        message: 'Pilih katalog tujuan terlebih dahulu.'
      })
      return
    }

    await executeBulkUpdate({ catalog_cardcode: catalogCardCode })
  }

  const totalActive = products.filter(p => p.is_active).length
  const totalIssues = products.filter(p => !p.is_active || p.stock === 0).length

  const changeActiveTab = (tab: 'live' | 'pending') => {
    setActiveTab(tab)
    setSelectedItems([])
    setBulkDialog(null)
    setEditingProduct(null)
    setBulkFeedback(null)
  }

  return (
    <main className="w-full min-h-screen flex flex-col text-white pb-10 px-8">

      {/* 1. HEADER & WIDGET STATISTIK */}
      <div className="pt-10 mb-8 relative z-10">
        <h1 className="text-3xl font-bold font-mono tracking-tight text-white">Product Inventory</h1>
        <p className="text-white/50 text-sm font-mono mt-1">Sistem PPOB Production Mode - Tersinkronisasi dengan Database DBeaver.</p>

        {/* WIDGET CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-xl shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#0084FF]/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-[#0084FF]/20"></div>
            <div className="flex items-center gap-5 relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-[#0084FF]/10 border border-[#0084FF]/20 flex items-center justify-center text-[#0084FF]"><Package size={28} /></div>
              <div>
                <p className="text-[11px] text-white/50 uppercase font-bold tracking-widest">Provider Online</p>
                {loading ? <div className="h-8 w-16 bg-white/10 animate-pulse rounded mt-1"></div> : <h3 className="text-3xl font-bold font-mono mt-1">{totalActive}</h3>}
              </div>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-xl shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-red-500/20"></div>
            <div className="flex items-center gap-5 relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400"><AlertTriangle size={28} /></div>
              <div>
                <p className="text-[11px] text-white/50 uppercase font-bold tracking-widest">Provider Issues / Empty</p>
                {loading ? <div className="h-8 w-16 bg-white/10 animate-pulse rounded mt-1"></div> : <h3 className="text-3xl font-bold font-mono mt-1 text-red-400">{totalIssues}</h3>}
              </div>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-xl shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-emerald-500/20"></div>
            <div className="flex items-center gap-5 relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400"><TrendingUp size={28} /></div>
              <div>
                <p className="text-[11px] text-white/50 uppercase font-bold tracking-widest">Avg Margin</p>
                {loading ? <div className="h-8 w-16 bg-white/10 animate-pulse rounded mt-1"></div> : <h3 className="text-3xl font-bold font-mono mt-1 text-emerald-400">Live</h3>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TABS PENGENDALI UTAMA (LIVE vs PENDING) */}
      <div className="flex gap-4 mb-2 relative z-20">
        <button
          onClick={() => changeActiveTab('live')}
          className={`px-6 py-2.5 rounded-t-xl font-bold text-sm transition-all border-b-2 ${activeTab === 'live' ? 'text-white border-[#0084FF] bg-white/5' : 'text-white/40 border-transparent hover:bg-white/5 hover:text-white'}`}
        >
          Produk Live
        </button>
        <button
          onClick={() => changeActiveTab('pending')}
          className={`px-6 py-2.5 rounded-t-xl font-bold text-sm flex items-center gap-2 transition-all border-b-2 ${activeTab === 'pending' ? 'text-orange-400 border-orange-500 bg-orange-500/5' : 'text-white/40 border-transparent hover:bg-white/5 hover:text-white'}`}
        >
          Perlu Mapping <AlertTriangle size={14} className={activeTab === 'pending' ? 'text-orange-500' : 'text-white/40'} />
        </button>
      </div>

      <div className="w-full h-[1px] bg-white/10 mb-6 relative z-20"></div>

      {/* RENDER BERDASARKAN TAB YANG DIPILIH */}
      {activeTab !== 'pending' ? (
        <>
          {/* TIER 1, 2, 3 (CONTROLS UNTUK TAB LIVE) */}
          <div className="flex flex-col gap-4 mb-6 relative z-20">
            {/* TIER 1: CATEGORY PILLS */}
            <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-2 w-full">
              {mainCategories.map((cat) => {
                const isActive = activeCategory === cat.id
                const Icon = cat.icon
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleCategoryChange(cat.id)}
                    onPointerUp={(event) => event.currentTarget.blur()}
                    className={`flex items-center gap-2 px-6 py-3 rounded-2xl whitespace-nowrap transition-all duration-300 font-bold text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0084FF]/70 ${isActive ? 'bg-[#0084FF] text-white shadow-[0_0_20px_rgba(0,132,255,0.4)]' : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white border border-white/10'}`}
                  >
                    <Icon size={18} className={isActive ? 'text-white' : 'text-white/50'} />
                    {cat.name}
                  </button>
                )
              })}
            </div>

            {/* TIER 2: ALL CATALOG TABS */}
            <div className="bg-black/10 border border-white/5 p-2 rounded-2xl w-full">
              <div className="flex gap-2 overflow-x-auto custom-scrollbar items-center pb-1">
                <button
                  type="button"
                  onClick={() => setActiveCatalog('all')}
                  onPointerUp={(event) => event.currentTarget.blur()}
                  className={`px-5 py-2.5 rounded-xl whitespace-nowrap transition-all font-bold text-xs uppercase tracking-wider focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0084FF]/70 ${activeCatalog === 'all' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
                >
                  Semua
                </button>
                <div className="w-[1px] h-6 bg-white/10 mx-1 shrink-0"></div>

                {loading ? (
                   <div className="flex gap-2 px-4"><Loader2 className="animate-spin text-white/40" size={18} /><span className="text-white/40 text-xs font-mono">Syncing nodes...</span></div>
                ) : (
                  availableCatalogs.map((cat) => {
                    const isActive = activeCatalog === cat.cardcode
                    return (
                      <button
                        key={cat.cardcode}
                        type="button"
                        onClick={() => setActiveCatalog(cat.cardcode)}
                        onPointerUp={(event) => event.currentTarget.blur()}
                        className={`px-5 py-2.5 rounded-xl whitespace-nowrap transition-all font-bold text-xs tracking-wider focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0084FF]/70 ${isActive ? 'bg-[#0084FF]/20 text-[#0084FF] border border-[#0084FF]/30 shadow-[inset_0_0_10px_rgba(0,132,255,0.2)]' : 'bg-transparent text-white/50 hover:text-white hover:bg-white/5 border border-transparent'}`}
                      >
                        {cat.name}
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            {/* TIER 3: SMART SEARCH & ACTIONS */}
            <div className="flex flex-col md:flex-row items-center gap-4 w-full mt-2">
              <div className="flex-1 flex items-center gap-3 px-5 py-3.5 bg-black/30 border border-white/10 rounded-2xl focus-within:border-[#0084FF]/50 focus-within:bg-black/40 transition-all w-full shadow-inner">
                <Search size={18} className="text-[#0084FF]" />
                <input
                  type="text"
                  placeholder={`Cari nama produk atau SKU...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-transparent text-white text-sm w-full focus:outline-none font-mono placeholder:text-white/30"
                />
              </div>

              <div className="flex gap-3 w-full md:w-auto">
                {activeTab === 'live' && (
                  <button
                    onClick={() => handleSyncAPI('all')}
                    disabled={isSyncing}
                    className={`flex-1 md:flex-none px-6 py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all font-bold text-sm border
                      ${isSyncing
                        ? 'bg-[#0084FF]/5 border-[#0084FF]/10 text-[#0084FF]/50 cursor-not-allowed'
                        : 'bg-[#0084FF]/10 border-[#0084FF]/30 text-[#0084FF] hover:bg-[#0084FF]/20'
                      }`}
                  >
                    {isSyncing ? <RefreshCw size={18} className="animate-spin" /> : <Zap size={18} />}
                    <span className="hidden sm:block">{isSyncing ? 'Syncing...' : 'Sync Provider'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {bulkFeedback && !bulkDialog && (
            <div className="mb-4">
              <BulkFeedbackBanner
                feedback={bulkFeedback}
                onDismiss={() => setBulkFeedback(null)}
              />
            </div>
          )}

          {selectedItems.length > 0 && (
            <section
              aria-label="Aksi produk terpilih"
              className="sticky top-4 z-40 mb-4 rounded-3xl border border-white/[0.08] bg-black/[0.035] p-4 backdrop-blur-md backdrop-saturate-150 sm:p-5"
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#0084FF]/25 bg-[#0084FF]/10 text-[#0084FF]">
                    <ListChecks size={19} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {selectedItems.length} produk dipilih
                    </p>
                    <p className="mt-1 text-xs text-white/40">
                      Pilihan tetap tersimpan saat filter atau pencarian berubah.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={isBulkActionLoading}
                    onClick={showBulkEditDialog}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#0084FF]/25 bg-[#0084FF]/10 px-3.5 text-xs font-semibold text-sky-200 transition-colors hover:bg-[#0084FF]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0084FF]/70 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Edit size={15} /> Edit Massal
                  </button>
                  <button
                    type="button"
                    disabled={isBulkActionLoading}
                    onClick={() => showBulkStatusDialog(true)}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] px-3.5 text-xs font-semibold text-emerald-200 transition-colors hover:bg-emerald-400/[0.13] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Power size={15} /> Aktifkan Store
                  </button>
                  <button
                    type="button"
                    disabled={isBulkActionLoading}
                    onClick={() => showBulkStatusDialog(false)}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.07] px-3.5 text-xs font-semibold text-amber-100 transition-colors hover:bg-amber-400/[0.13] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <PowerOff size={15} /> Nonaktifkan Store
                  </button>
                  <button
                    type="button"
                    disabled={isBulkActionLoading}
                    onClick={showMoveCatalogDialog}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 text-xs font-semibold text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0084FF]/70 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <MoveRight size={15} /> Pindahkan katalog
                  </button>
                  <button
                    type="button"
                    disabled={isBulkActionLoading}
                    onClick={() => setSelectedItems([])}
                    className="min-h-10 rounded-xl px-3.5 text-xs font-medium text-white/40 transition-colors hover:bg-white/[0.05] hover:text-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Bersihkan pilihan
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* PRODUCT INVENTORY (TAB LIVE) */}
          <div className="relative z-10 w-full overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-4 shadow-2xl backdrop-blur-xl sm:p-6">
            <div className="hidden lg:block">
              <table className="w-full table-fixed border-collapse text-left">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="w-[52px] py-4 pl-2">
                      <SelectionCheckbox
                        checked={allDisplayedSelected}
                        indeterminate={someDisplayedSelected}
                        disabled={displayedProductIDs.length === 0}
                        label={
                          allDisplayedSelected
                            ? 'Hapus pilihan semua produk yang sedang tampil'
                            : 'Pilih semua produk yang sedang tampil'
                        }
                        onChange={toggleAllDisplayedProducts}
                      />
                    </th>
                    <th className="px-3 text-[11px] font-bold uppercase tracking-widest text-white/40">Product</th>
                    <th className="w-[19%] px-3 text-[11px] font-bold uppercase tracking-widest text-white/40">Provider / SKU</th>
                    <th className="w-[16%] px-3 text-right text-[11px] font-bold uppercase tracking-widest text-white/40">Price</th>
                    <th className="w-[9%] px-2 text-center text-[11px] font-bold uppercase tracking-widest text-white/40">Stock</th>
                    <th className="w-[18%] px-2 text-center text-[11px] font-bold uppercase tracking-widest text-white/40">Status</th>
                    <th className="w-[68px] pr-2 text-right text-[11px] font-bold uppercase tracking-widest text-white/40">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-white/5 animate-pulse">
                        <td className="py-5 pl-2"><div className="h-5 w-5 rounded bg-white/5" /></td>
                        <td className="px-3"><div className="flex items-center gap-3"><div className="h-12 w-12 shrink-0 rounded-2xl bg-white/5" /><div className="min-w-0 flex-1"><div className="mb-2 h-4 w-2/3 rounded bg-white/5" /><div className="h-3 w-1/3 rounded bg-white/5" /></div></div></td>
                        <td className="px-3"><div className="mb-2 h-3 w-1/2 rounded bg-white/5" /><div className="h-3 w-3/4 rounded bg-white/5" /></td>
                        <td className="px-3"><div className="ml-auto mb-2 h-4 w-3/4 rounded bg-white/5" /><div className="ml-auto h-3 w-2/3 rounded bg-white/5" /></td>
                        <td className="px-2"><div className="mx-auto h-4 w-10 rounded bg-white/5" /></td>
                        <td className="px-2"><div className="mx-auto mb-1 h-6 w-24 rounded-xl bg-white/5" /><div className="mx-auto h-6 w-20 rounded-xl bg-white/5" /></td>
                        <td className="pr-2"><div className="ml-auto h-9 w-9 rounded-xl bg-white/5" /></td>
                      </tr>
                    ))
                  ) : displayedProducts.length > 0 ? (
                    displayedProducts.map((p) => {
                      const isSelected = selectedItems.includes(p.ID);
                      const pCatalogCode = p.catalog_cardcode || p.catalog?.cardcode || '';
                      const catalogInfo = catalogs.find(c => c.cardcode === pCatalogCode);

                      return (
                        <tr key={p.ID} className={`group h-[88px] border-b border-white/5 transition-colors hover:bg-white/[0.035] ${isSelected ? 'bg-[#0084FF]/[0.045]' : ''}`}>
                          <td className="py-4 pl-2">
                            <SelectionCheckbox
                              checked={isSelected}
                              label={`${isSelected ? 'Hapus pilihan' : 'Pilih'} ${p.name}`}
                              onChange={() => toggleProductSelection(p.ID)}
                            />
                          </td>
                          <td className="px-3 align-middle">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="shrink-0"><ProductTableThumbnail imageUrl={p.image_url} productName={p.name} /></div>
                              <div className="min-w-0">
                                <p className="line-clamp-2 font-sans text-sm font-bold leading-5 text-white/90">{p.name}</p>
                                <span className="mt-1 inline-flex max-w-full truncate rounded bg-white/5 px-1.5 py-0.5 text-[9px] uppercase text-white/40">
                                  {catalogInfo?.name || pCatalogCode || 'UNKNOWN'}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 align-middle">
                            <p className="truncate font-sans text-[11px] uppercase tracking-wider text-white/50">{p.provider || '-'}</p>
                            <p className="mt-1 truncate font-mono text-[11px] font-medium uppercase tracking-wider text-[#0084FF]" title={p.code}>{p.code || '-'}</p>
                          </td>
                          <td className="px-3 text-right">
                            <p className="text-[9px] uppercase tracking-wider text-white/35">Jual</p>
                            <p className="truncate font-mono text-xs font-bold text-white">Rp {getProductSellingPrice(p).toLocaleString('id-ID')}</p>
                            {p.original_price !== null &&
                              p.original_price !== undefined &&
                              p.original_price > getProductSellingPrice(p) && (
                                <p className="mt-1 truncate text-[10px] text-white/35 line-through">
                                  Normal Rp {p.original_price.toLocaleString('id-ID')}
                                </p>
                              )}
                            <p className="mt-1 truncate text-[10px] text-white/40">Modal Rp {p.price.toLocaleString()}</p>
                          </td>
                          <td className="px-2 text-center font-mono text-sm text-white/80">
                            {p.stock === -1 ? '∞' : p.stock === 0 ? <span className="text-red-400 text-xs font-bold bg-red-500/10 px-2 py-1 rounded-md">KOSONG</span> : p.stock}
                          </td>
                          <td className="px-2 text-center">
                            <div className="flex flex-col items-center gap-1">
                            <span className={`inline-flex min-h-6 items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.06em] ${
                              p.is_active
                                ? 'border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-300'
                                : 'border-red-500/20 bg-red-500/[0.08] text-red-300'
                            }`}>
                              {p.is_active ? 'PROVIDER ONLINE' : 'PROVIDER OFFLINE'}
                            </span>
                            <span className={`inline-flex min-h-6 items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.06em] ${
                              p.admin_enabled
                                ? 'border-sky-500/20 bg-sky-500/[0.08] text-sky-300'
                                : 'border-amber-500/20 bg-amber-500/[0.08] text-amber-200'
                            }`}>
                              {p.admin_enabled ? 'STORE AKTIF' : 'STORE NONAKTIF'}
                            </span>
                            </div>
                          </td>
                          <td className="pr-2 text-right">
                            <button
                              type="button"
                              onClick={() => openProductEditor(p)}
                              aria-label={`Edit ${p.name}`}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-white/45 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0084FF]/60"
                            >
                              <Edit size={18} />
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-20 text-center text-white/40 font-mono text-sm">
                        <AlertTriangle size={40} className="mx-auto mb-4 text-white/20" />
                        Tidak ada produk ditemukan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="lg:hidden">
              <div className="mb-3 flex items-center justify-between rounded-2xl border border-white/5 bg-black/10 px-4 py-3">
                <div className="flex items-center gap-3">
                  <SelectionCheckbox
                    checked={allDisplayedSelected}
                    indeterminate={someDisplayedSelected}
                    disabled={displayedProductIDs.length === 0}
                    label={allDisplayedSelected ? 'Hapus pilihan semua produk yang sedang tampil' : 'Pilih semua produk yang sedang tampil'}
                    onChange={toggleAllDisplayedProducts}
                  />
                  <span className="text-xs font-semibold text-white/60">Pilih semua yang tampil</span>
                </div>
                <span className="font-mono text-[10px] text-white/35">{displayedProducts.length} produk</span>
              </div>

              <div className="space-y-3">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="animate-pulse rounded-2xl border border-white/5 bg-white/[0.025] p-4">
                      <div className="flex gap-3">
                        <div className="h-12 w-12 rounded-2xl bg-white/5" />
                        <div className="flex-1"><div className="mb-2 h-4 w-3/4 rounded bg-white/5" /><div className="h-3 w-1/3 rounded bg-white/5" /></div>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        {Array.from({ length: 4 }).map((__, j) => <div key={j} className="h-14 rounded-xl bg-white/5" />)}
                      </div>
                    </div>
                  ))
                ) : displayedProducts.length > 0 ? (
                  displayedProducts.map((p) => {
                    const isSelected = selectedItems.includes(p.ID)
                    const pCatalogCode = p.catalog_cardcode || p.catalog?.cardcode || ''
                    const catalogInfo = catalogs.find(c => c.cardcode === pCatalogCode)

                    return (
                      <article key={p.ID} className={`group rounded-2xl border p-4 transition-colors ${isSelected ? 'border-[#0084FF]/25 bg-[#0084FF]/[0.045]' : 'border-white/5 bg-white/[0.025]'}`}>
                        <div className="flex items-start gap-3">
                          <div className="pt-3">
                            <SelectionCheckbox checked={isSelected} label={`${isSelected ? 'Hapus pilihan' : 'Pilih'} ${p.name}`} onChange={() => toggleProductSelection(p.ID)} />
                          </div>
                          <ProductTableThumbnail imageUrl={p.image_url} productName={p.name} />
                          <div className="min-w-0 flex-1">
                            <h3 className="line-clamp-2 text-sm font-bold leading-5 text-white/90">{p.name}</h3>
                            <span className="mt-1 inline-flex max-w-full truncate rounded bg-white/5 px-1.5 py-0.5 text-[9px] uppercase text-white/40">{catalogInfo?.name || pCatalogCode || 'UNKNOWN'}</span>
                          </div>
                          <button type="button" onClick={() => openProductEditor(p)} aria-label={`Edit ${p.name}`} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white/45 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0084FF]/60">
                            <Edit size={18} />
                          </button>
                        </div>

                        <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                          <div className="min-w-0 rounded-xl bg-black/10 p-3">
                            <dt className="text-[9px] uppercase tracking-wider text-white/35">Provider / SKU</dt>
                            <dd className="mt-1 truncate uppercase text-white/65">{p.provider || '-'}</dd>
                            <dd className="mt-1 truncate font-mono text-[10px] text-[#0084FF]" title={p.code}>{p.code || '-'}</dd>
                          </div>
                          <div className="min-w-0 rounded-xl bg-black/10 p-3 text-right">
                            <dt className="text-[9px] uppercase tracking-wider text-white/35">Harga</dt>
                            <dd className="mt-1 truncate font-mono font-bold text-white">Jual Rp {getProductSellingPrice(p).toLocaleString('id-ID')}</dd>
                            {p.original_price !== null &&
                              p.original_price !== undefined &&
                              p.original_price > getProductSellingPrice(p) && (
                                <dd className="mt-1 truncate text-[10px] text-white/35 line-through">
                                  Normal Rp {p.original_price.toLocaleString('id-ID')}
                                </dd>
                              )}
                            <dd className="mt-1 truncate text-[10px] text-white/40">Modal Rp {p.price.toLocaleString()}</dd>
                          </div>
                          <div className="rounded-xl bg-black/10 p-3">
                            <dt className="text-[9px] uppercase tracking-wider text-white/35">Stock</dt>
                            <dd className="mt-1 font-mono text-white/75">{p.stock === -1 ? '\u221E' : p.stock === 0 ? 'KOSONG' : p.stock}</dd>
                          </div>
                          <div className="rounded-xl bg-black/10 p-3">
                            <dt className="text-[9px] uppercase tracking-wider text-white/35">Status</dt>
                            <dd className={`mt-1 text-[10px] font-semibold ${p.is_active ? 'text-emerald-300' : 'text-red-300'}`}>Provider {p.is_active ? 'online' : 'offline'}</dd>
                            <dd className={`mt-1 text-[10px] font-semibold ${p.admin_enabled ? 'text-sky-300' : 'text-amber-200'}`}>Store {p.admin_enabled ? 'aktif' : 'nonaktif'}</dd>
                          </div>
                        </dl>
                      </article>
                    )
                  })
                ) : (
                  <div className="py-16 text-center font-mono text-sm text-white/40">
                    <AlertTriangle size={40} className="mx-auto mb-4 text-white/20" />
                    Tidak ada produk ditemukan.
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        // Kalau tab Pending yang dipencet
        <PendingProductsTable />
      )}

      {editingProduct && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="product-editor-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
        >
          <button
            type="button"
            aria-label="Tutup editor produk"
            onClick={closeProductEditor}
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
          />

          <form
            onSubmit={handleProductUpdate}
            className="relative z-10 w-full max-w-xl rounded-3xl border border-white/10 bg-[#090b12] p-6 shadow-2xl sm:p-8"
          >
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/40">
                  Product editor
                </p>
                <h2
                  id="product-editor-title"
                  className="mt-2 text-2xl font-semibold text-white"
                >
                  {editingProduct.name}
                </h2>
                <p className="mt-2 font-mono text-xs text-white/40">
                  {editingProduct.code}
                </p>
              </div>

              <button
                type="button"
                onClick={closeProductEditor}
                className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/50 transition-colors hover:bg-white/5 hover:text-white"
              >
                Tutup
              </button>
            </div>

            <div className="mt-7 flex min-h-[128px] items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.025] p-4">
              {editForm.image_url.trim() && !thumbnailPreviewError ? (
                // Static export memakai URL thumbnail langsung.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={editForm.image_url.trim()}
                  alt={`Preview thumbnail ${editingProduct.name}`}
                  onError={() => setThumbnailPreviewError(true)}
                  className="h-24 w-24 object-contain"
                />
              ) : (
                <div className="text-center">
                  <Package
                    aria-hidden="true"
                    size={28}
                    className="mx-auto text-white/20"
                  />
                  <p className="mt-2 text-xs text-white/35">
                    Thumbnail belum tersedia
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 space-y-5">
              <div>
                <label
                  htmlFor="product-image-url"
                  className="text-xs font-medium text-white/65"
                >
                  Thumbnail URL
                </label>
                <input
                  id="product-image-url"
                  type="text"
                  value={editForm.image_url}
                  onChange={event => {
                    setEditForm(current => ({
                      ...current,
                      image_url: event.target.value
                    }))
                    setThumbnailPreviewError(false)
                  }}
                  placeholder="https://..."
                  className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-white/[0.025] px-4 text-sm text-white outline-none placeholder:text-white/25 focus:border-fuchsia-400/50 focus:ring-2 focus:ring-fuchsia-400/10"
                />
                <p className="mt-2 text-xs leading-5 text-white/40">
                  Rekomendasi WebP transparan 512x512 dengan safe area 8–12%.
                </p>
              </div>

              <div>
                <label
                  htmlFor="product-original-price"
                  className="text-xs font-medium text-white/65"
                >
                  Harga Normal / Harga Coret
                </label>
                <input
                  id="product-original-price"
                  type="number"
                  min="0"
                  step="1"
                  inputMode="decimal"
                  value={editForm.original_price}
                  onChange={event =>
                    setEditForm(current => ({
                      ...current,
                      original_price: event.target.value
                    }))
                  }
                  placeholder="Opsional"
                  className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-white/[0.025] px-4 text-sm text-white outline-none placeholder:text-white/25 focus:border-fuchsia-400/50 focus:ring-2 focus:ring-fuchsia-400/10"
                />
                <p className="mt-2 text-xs leading-5 text-white/40">
                  Kosongkan untuk menghapus harga normal. Badge diskon hanya
                  tampil jika nilainya lebih tinggi dari harga final.
                </p>
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeProductEditor}
                disabled={isSavingProduct}
                className="min-h-11 rounded-full border border-white/10 px-5 text-sm text-white/55 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSavingProduct}
                className="min-h-11 rounded-full border border-fuchsia-300/30 bg-fuchsia-400/15 px-6 text-sm font-semibold text-fuchsia-100 transition-colors hover:bg-fuchsia-400/25 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSavingProduct ? 'Menyimpan...' : 'Simpan perubahan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {bulkDialog === 'edit' && (
        <BulkModal
          title="Bulk Edit Produk"
          description={`${selectedItems.length} produk akan diproses. Hanya field yang diaktifkan yang dikirim ke backend.`}
          titleId="bulk-edit-title"
          onClose={closeBulkDialog}
          isBusy={isBulkActionLoading}
          wide
        >
          <form onSubmit={handleBulkEditSubmit} className="mt-7 space-y-6">
            {bulkFeedback?.type === 'error' && (
              <BulkFeedbackBanner feedback={bulkFeedback} />
            )}

            <section className="grid gap-4 md:grid-cols-2">
              <div className={`rounded-2xl border p-4 transition-colors ${
                bulkEditForm.applyStatus
                  ? 'border-[#0084FF]/30 bg-[#0084FF]/[0.07]'
                  : 'border-white/10 bg-white/[0.025]'
              }`}>
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={bulkEditForm.applyStatus}
                    onChange={event =>
                      setBulkEditForm(current => ({
                        ...current,
                        applyStatus: event.target.checked
                      }))
                    }
                    className="mt-0.5 h-4 w-4 accent-[#0084FF]"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-white">
                      Terapkan perubahan status storefront
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-white/40">
                      Status provider tetap dikelola otomatis oleh sinkronisasi.
                    </span>
                  </span>
                </label>

                <label className="mt-4 block text-xs font-medium text-white/55">
                  Status storefront
                  <select
                    value={bulkEditForm.adminEnabled ? 'active' : 'inactive'}
                    disabled={!bulkEditForm.applyStatus}
                    onChange={event =>
                      setBulkEditForm(current => ({
                        ...current,
                        adminEnabled: event.target.value === 'active'
                      }))
                    }
                    className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0b0e16] px-3 text-sm text-white outline-none focus:border-[#0084FF]/60 disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    <option value="active">Aktif</option>
                    <option value="inactive">Nonaktif</option>
                  </select>
                </label>
              </div>

              <div className={`rounded-2xl border p-4 transition-colors ${
                bulkEditForm.applyCatalog
                  ? 'border-[#0084FF]/30 bg-[#0084FF]/[0.07]'
                  : 'border-white/10 bg-white/[0.025]'
              }`}>
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={bulkEditForm.applyCatalog}
                    onChange={event =>
                      setBulkEditForm(current => ({
                        ...current,
                        applyCatalog: event.target.checked
                      }))
                    }
                    className="mt-0.5 h-4 w-4 accent-[#0084FF]"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-white">
                      Terapkan perubahan katalog
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-white/40">
                      Produk akan dipindahkan memakai cardcode katalog tujuan.
                    </span>
                  </span>
                </label>

                <label className="mt-4 block text-xs font-medium text-white/55">
                  Katalog tujuan
                  <select
                    value={bulkEditForm.catalogCardCode}
                    disabled={!bulkEditForm.applyCatalog}
                    onChange={event =>
                      setBulkEditForm(current => ({
                        ...current,
                        catalogCardCode: event.target.value
                      }))
                    }
                    className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0b0e16] px-3 text-sm text-white outline-none focus:border-[#0084FF]/60 disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    <option value="">Pilih katalog</option>
                    {catalogs.map(catalog => (
                      <option key={catalog.cardcode} value={catalog.cardcode}>
                        {catalog.name} ({catalog.cardcode})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className={`rounded-2xl border p-4 transition-colors md:col-span-2 ${
                bulkEditForm.applyImage
                  ? 'border-[#0084FF]/30 bg-[#0084FF]/[0.07]'
                  : 'border-white/10 bg-white/[0.025]'
              }`}>
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={bulkEditForm.applyImage}
                    onChange={event =>
                      setBulkEditForm(current => ({
                        ...current,
                        applyImage: event.target.checked
                      }))
                    }
                    className="mt-0.5 h-4 w-4 accent-[#0084FF]"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-white">
                      Terapkan thumbnail yang sama
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-white/40">
                      URL ini akan mengganti thumbnail seluruh produk yang dipilih.
                    </span>
                  </span>
                </label>

                <label className="mt-4 block text-xs font-medium text-white/55">
                  Thumbnail URL
                  <input
                    type="text"
                    inputMode="url"
                    value={bulkEditForm.imageUrl}
                    disabled={!bulkEditForm.applyImage}
                    placeholder="https://i.imgur.com/vkLufAE.png"
                    onChange={event =>
                      setBulkEditForm(current => ({
                        ...current,
                        imageUrl: event.target.value
                      }))
                    }
                    className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0b0e16] px-3 font-mono text-xs text-white outline-none placeholder:text-white/20 focus:border-[#0084FF]/60 disabled:cursor-not-allowed disabled:opacity-35"
                  />
                </label>
                <p className="mt-2 text-[10px] leading-4 text-white/30">
                  Gunakan URL mentah http(s) atau path lokal /images/..., bukan format Markdown.
                </p>
              </div>

            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
              <div className="flex items-start gap-3">
                <Info size={17} className="mt-0.5 shrink-0 text-[#0084FF]" />
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Ringkasan perubahan
                  </h3>
                  <ul className="mt-2 space-y-1.5 text-xs leading-5 text-white/50">
                    <li>{selectedItems.length} produk akan diproses.</li>
                    {bulkEditForm.applyStatus && (
                      <li>
                        Status storefront → {bulkEditForm.adminEnabled ? 'Aktif' : 'Nonaktif'}
                      </li>
                    )}
                    {bulkEditForm.applyCatalog && (
                      <li>
                        Katalog → {
                          catalogs.find(
                            catalog =>
                              catalog.cardcode === bulkEditForm.catalogCardCode
                          )?.name || 'Belum dipilih'
                        }
                      </li>
                    )}
                    {bulkEditForm.applyImage && (
                      <li className="break-all">
                        Thumbnail → {bulkEditForm.imageUrl.trim() || 'Belum diisi'}
                      </li>
                    )}
                    {!bulkEditForm.applyStatus &&
                      !bulkEditForm.applyCatalog &&
                      !bulkEditForm.applyImage && (
                      <li>Belum ada perubahan yang diaktifkan.</li>
                    )}
                  </ul>
                </div>
              </div>
            </section>

            <details className="rounded-2xl border border-white/[0.07] bg-black/20">
              <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-white/45 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0084FF]/60">
                Tidak tersedia untuk edit massal
              </summary>
              <div className="grid gap-3 border-t border-white/[0.07] p-4 sm:grid-cols-2 lg:grid-cols-3">
                {disabledBulkFields.map(([label, reason]) => (
                  <label key={label} className="block">
                    <span className="text-[11px] font-medium text-white/40">
                      {label}
                    </span>
                    <input
                      type="text"
                      disabled
                      value="Dikelola per produk"
                      readOnly
                      className="mt-1.5 h-9 w-full rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 text-xs text-white/25"
                    />
                    <span className="mt-1.5 block text-[10px] leading-4 text-white/25">
                      {reason}
                    </span>
                  </label>
                ))}
              </div>
            </details>

            <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={isBulkActionLoading}
                onClick={closeBulkDialog}
                className="min-h-11 rounded-full border border-white/10 px-5 text-sm text-white/55 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={
                  isBulkActionLoading ||
                  (
                    !bulkEditForm.applyStatus &&
                    !bulkEditForm.applyCatalog &&
                    !bulkEditForm.applyImage
                  )
                }
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#0084FF]/35 bg-[#0084FF]/15 px-6 text-sm font-semibold text-sky-100 transition-colors hover:bg-[#0084FF]/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isBulkActionLoading && <Loader2 size={16} className="animate-spin" />}
                Simpan perubahan massal
              </button>
            </div>
          </form>
        </BulkModal>
      )}

      {bulkDialog === 'status' && (
        <BulkModal
          title={pendingBulkStatus ? 'Aktifkan Store' : 'Nonaktifkan Store'}
          description={`${selectedItems.length} produk akan diubah status storefront-nya.`}
          titleId="bulk-status-title"
          onClose={closeBulkDialog}
          isBusy={isBulkActionLoading}
        >
          <form
            onSubmit={event => {
              event.preventDefault()
              void executeBulkUpdate({ admin_enabled: pendingBulkStatus })
            }}
            className="mt-7 space-y-5"
          >
            {bulkFeedback?.type === 'error' && (
              <BulkFeedbackBanner feedback={bulkFeedback} />
            )}
            <div className={`rounded-2xl border p-5 ${
              pendingBulkStatus
                ? 'border-emerald-400/20 bg-emerald-400/[0.07]'
                : 'border-amber-400/20 bg-amber-400/[0.07]'
            }`}>
              <p className="text-sm leading-6 text-white/65">
                Konfirmasi perubahan status storefront untuk{' '}
                <strong className="text-white">{selectedItems.length} produk</strong>{' '}
                menjadi {pendingBulkStatus ? 'Aktif' : 'Nonaktif'}. Status provider
                tidak berubah.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                disabled={isBulkActionLoading}
                onClick={closeBulkDialog}
                className="min-h-11 rounded-full border border-white/10 px-5 text-sm text-white/55 hover:bg-white/5 disabled:opacity-40"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isBulkActionLoading}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-black transition-colors hover:bg-white/85 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isBulkActionLoading && <Loader2 size={16} className="animate-spin" />}
                Konfirmasi {selectedItems.length} produk
              </button>
            </div>
          </form>
        </BulkModal>
      )}

      {bulkDialog === 'move' && (
        <BulkModal
          title="Pindahkan katalog"
          description={`Pilih katalog tujuan untuk ${selectedItems.length} produk terpilih.`}
          titleId="bulk-move-title"
          onClose={closeBulkDialog}
          isBusy={isBulkActionLoading}
        >
          <form onSubmit={handleMoveCatalog} className="mt-7 space-y-5">
            {bulkFeedback?.type === 'error' && (
              <BulkFeedbackBanner feedback={bulkFeedback} />
            )}
            <label className="block text-xs font-medium text-white/60">
              Katalog tujuan
              <select
                value={moveCatalogCardCode}
                onChange={event => setMoveCatalogCardCode(event.target.value)}
                className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-[#0b0e16] px-4 text-sm text-white outline-none focus:border-[#0084FF]/60"
              >
                <option value="">Pilih katalog</option>
                {catalogs.map(catalog => (
                  <option key={catalog.cardcode} value={catalog.cardcode}>
                    {catalog.name} ({catalog.cardcode})
                  </option>
                ))}
              </select>
            </label>
            <p className="rounded-2xl border border-white/[0.07] bg-white/[0.025] px-4 py-3 text-xs leading-5 text-white/40">
              Product ID, SKU, harga, thumbnail, provider, dan stock tidak ikut
              berubah.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                disabled={isBulkActionLoading}
                onClick={closeBulkDialog}
                className="min-h-11 rounded-full border border-white/10 px-5 text-sm text-white/55 hover:bg-white/5 disabled:opacity-40"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isBulkActionLoading || !moveCatalogCardCode}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#0084FF]/35 bg-[#0084FF]/15 px-6 text-sm font-semibold text-sky-100 hover:bg-[#0084FF]/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isBulkActionLoading && <Loader2 size={16} className="animate-spin" />}
                Pindahkan {selectedItems.length} produk
              </button>
            </div>
          </form>
        </BulkModal>
      )}

    </main>
  )
}
