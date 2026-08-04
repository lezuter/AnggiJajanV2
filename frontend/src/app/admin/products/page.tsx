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
  Power, PowerOff, MoveRight, X, Info, FolderTree
} from 'lucide-react'

// 🔥 1. IMPORT SATPAM 401
import { useApi } from '@/hooks/useApi'
import PendingProductsTable from '@/components/PendingProductsTable'
import ProductGroupManager, {
  type ProductGroup,
  type ProductGroupFilter,
  type ProductGroupInput
} from '@/components/ProductGroupManager'
import { Checkbox } from '@/components/ui/checkbox'
import { getProductSellingPrice } from '@/lib/pricing'

// ==========================================
// INTERFACES & CONSTANTS
// ==========================================
interface Catalog {
  id?: number | string;
  name: string;
  cardcode: string;
  category_id?: string | number;
  category?: string;
  markup_percent?: number | null;
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
  product_group_id?: number | null;
  product_group?: ProductGroup | null;
  sort_order?: number;
}

interface ProductEditForm {
  image_url: string;
  original_price: string;
}

type BulkDialog = 'edit' | 'status' | 'move' | 'group' | null

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

interface ProductSyncJobPayload {
  id?: string;
  job_id?: string;
  status?: 'running' | 'completed' | 'failed';
  stage?: string;
  progress?: number;
  processed?: number;
  total?: number;
  error?: string;
}

interface ProviderSyncStatus {
  provider: string;
  running: boolean;
  source: 'cron' | 'manual' | '';
  last_started_at?: string | null;
  last_finished_at?: string | null;
  last_success_at?: string | null;
  last_error?: string;
  cooldown_until?: string | null;
  retry_after_seconds: number;
}

interface ProductGroupPayload {
  ID?: number;
  id?: number;
  name?: string;
  catalog_cardcode?: string;
  sort_order?: number;
  is_active?: boolean;
  markup_percent?: number | null;
  product_count?: number;
  products?: Array<{ ID?: number; id?: number }>;
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

function getProductCatalogCode(product: Product) {
  return product.catalog_cardcode || product.catalog?.cardcode || ''
}

function getProductGroupID(product: Product) {
  return product.product_group_id ?? product.product_group?.ID ?? null
}

function getPayloadError(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object') {
    const error = (payload as { error?: unknown }).error
    if (typeof error === 'string' && error.trim()) return error
  }

  return fallback
}

function formatSyncCountdown(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.ceil(totalSeconds))
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

async function readJSONPayload(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function normalizeProductGroups(
  payload: unknown,
  catalogCardCode: string
): ProductGroup[] {
  let rawGroups: unknown[] = []

  if (Array.isArray(payload)) {
    rawGroups = payload
  } else if (payload && typeof payload === 'object') {
    const objectPayload = payload as {
      product_groups?: unknown;
      data?: unknown;
    }

    if (Array.isArray(objectPayload.product_groups)) {
      rawGroups = objectPayload.product_groups
    } else if (Array.isArray(objectPayload.data)) {
      rawGroups = objectPayload.data
    }
  }

  return rawGroups
    .map((rawGroup): ProductGroup | null => {
      if (!rawGroup || typeof rawGroup !== 'object') return null

      const group = rawGroup as ProductGroupPayload
      const groupID = group.ID ?? group.id
      if (!groupID || typeof group.name !== 'string') return null

      const products = Array.isArray(group.products)
        ? group.products
            .map(product => {
              const productID = product.ID ?? product.id
              return productID ? { ID: productID } : null
            })
            .filter((product): product is { ID: number } => product !== null)
        : undefined

      return {
        ID: groupID,
        name: group.name,
        catalog_cardcode: group.catalog_cardcode || catalogCardCode,
        sort_order: Number.isFinite(group.sort_order) ? group.sort_order as number : 0,
        is_active: group.is_active !== false,
        markup_percent:
          typeof group.markup_percent === 'number' &&
          Number.isFinite(group.markup_percent)
            ? group.markup_percent
            : null,
        product_count: group.product_count,
        products
      }
    })
    .filter((group): group is ProductGroup => group !== null)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
}

const mainCategories = [
  { id: 'all', name: 'Semua', icon: Package },
  { id: 'games', name: 'Games', icon: Gamepad2 },
  { id: 'pulsa', name: 'Pulsa & Data', icon: Smartphone },
  { id: 'emoney', name: 'E-Money', icon: Wallet },
  { id: 'pln', name: 'Token PLN', icon: Zap },
]

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
  const { get, post, put, patch, delete: deleteRequest } = useApi()

  // ==========================================
  // STATE MANAGEMENT
  // ==========================================
  const [activeTab, setActiveTab] = useState<'live' | 'pending'>('live')

  const [products, setProducts] = useState<Product[]>([])
  const [catalogs, setCatalogs] = useState<Catalog[]>([])

  const [loading, setLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState(0)
  const [syncStage, setSyncStage] = useState('Menyiapkan sinkronisasi')
  const [syncProcessed, setSyncProcessed] = useState(0)
  const [syncTotal, setSyncTotal] = useState(0)
  const [digiflazzSyncStatus, setDigiflazzSyncStatus] =
    useState<ProviderSyncStatus | null>(null)
  const [syncRetryAfter, setSyncRetryAfter] = useState(0)
  const [syncFeedback, setSyncFeedback] = useState<BulkFeedback | null>(null)
  const syncPollRunIDRef = useRef(0)
  const syncStatusRequestInFlightRef = useRef(false)

  const [activeCategory, setActiveCategory] = useState('all')
  const [activeCatalog, setActiveCatalog] = useState('all')
  const [activeGroupFilter, setActiveGroupFilter] =
    useState<ProductGroupFilter>('all')
  const [productGroups, setProductGroups] = useState<ProductGroup[]>([])
  const [productGroupsLoading, setProductGroupsLoading] = useState(false)
  const [productGroupsLoadError, setProductGroupsLoadError] = useState<string | null>(null)
  const [isProductGroupMutating, setIsProductGroupMutating] = useState(false)
  const activeCatalogRef = useRef('all')
  const productGroupRequestIDRef = useRef(0)
  const productGroupMutationLockRef = useRef(false)
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
  const [assignmentGroupValue, setAssignmentGroupValue] = useState('')
  const [isBulkActionLoading, setIsBulkActionLoading] = useState(false)
  const [isGroupAssignmentLoading, setIsGroupAssignmentLoading] = useState(false)
  const bulkActionLockRef = useRef(false)
  const groupAssignmentLockRef = useRef(false)
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

  const fetchDigiflazzSyncStatus = useCallback(async () => {
    if (syncStatusRequestInFlightRef.current) return
    syncStatusRequestInFlightRef.current = true

    try {
      const response = await get('/admin/products/sync-status/digiflazz')
      const payload = await readJSONPayload(response) as ProviderSyncStatus | null
      if (!response.ok || !payload) return

      setDigiflazzSyncStatus(payload)
      setSyncRetryAfter(Math.max(0, payload.retry_after_seconds || 0))
    } catch (error) {
      console.error('Status sync Digiflazz gagal dimuat:', error)
    } finally {
      syncStatusRequestInFlightRef.current = false
    }
  }, [get])

  const fetchProductGroups = useCallback(async (catalogCardCode: string) => {
    if (catalogCardCode === 'all') {
      productGroupRequestIDRef.current += 1
      setProductGroups([])
      setProductGroupsLoadError(null)
      setProductGroupsLoading(false)
      return
    }

    if (catalogCardCode !== activeCatalogRef.current) return

    const requestID = ++productGroupRequestIDRef.current

    setProductGroupsLoading(true)
    setProductGroupsLoadError(null)

    try {
      const response = await get(
        `/admin/catalogs/${encodeURIComponent(catalogCardCode)}/product-groups`
      )
      const payload = await readJSONPayload(response)

      if (!response.ok) {
        throw new Error(
          getPayloadError(payload, 'Kelompok produk gagal dimuat.')
        )
      }

      if (
        requestID !== productGroupRequestIDRef.current ||
        catalogCardCode !== activeCatalogRef.current
      ) return

      setProductGroups(normalizeProductGroups(payload, catalogCardCode))
    } catch (error) {
      if (
        requestID !== productGroupRequestIDRef.current ||
        catalogCardCode !== activeCatalogRef.current
      ) return

      setProductGroups([])
      setProductGroupsLoadError(
        error instanceof Error
          ? error.message
          : 'Kelompok produk gagal dimuat.'
      )
    } finally {
      if (
        requestID === productGroupRequestIDRef.current &&
        catalogCardCode === activeCatalogRef.current
      ) {
        setProductGroupsLoading(false)
      }
    }
  }, [get])

  useEffect(() => {
    fetchAllData()
  }, [fetchAllData])

  useEffect(() => {
    void fetchDigiflazzSyncStatus()
  }, [fetchDigiflazzSyncStatus])

  useEffect(() => {
    const pollingInterval = window.setInterval(
      () => void fetchDigiflazzSyncStatus(),
      digiflazzSyncStatus?.running ? 2000 : 5000
    )
    return () => window.clearInterval(pollingInterval)
  }, [digiflazzSyncStatus?.running, fetchDigiflazzSyncStatus])

  useEffect(() => {
    const countdownInterval = window.setInterval(() => {
      setSyncRetryAfter(current => Math.max(0, current - 1))
    }, 1000)
    return () => window.clearInterval(countdownInterval)
  }, [])

  useEffect(() => {
    return () => {
      syncPollRunIDRef.current += 1
    }
  }, [])

  useEffect(() => {
    if (activeCatalog === 'all') return
    void fetchProductGroups(activeCatalog)
  }, [activeCatalog, fetchProductGroups])

  const handleSyncAPI = async () => {
    const pollRunID = ++syncPollRunIDRef.current
    setIsSyncing(true)
    setSyncFeedback(null)
    setSyncProgress(1)
    setSyncStage('Menunggu proses sinkronisasi')
    setSyncProcessed(0)
    setSyncTotal(0)

    try {
      const startResponse = await post('/admin/products/sync-jobs/digiflazz', {})
      const startPayload = await readJSONPayload(startResponse) as ProductSyncJobPayload | null
      if (!startResponse.ok) {
        if (startResponse.status === 409 || startResponse.status === 429) {
          setSyncFeedback({
            type: 'error',
            message: getPayloadError(
              startPayload,
              'Sinkronisasi Digiflazz belum dapat dimulai.'
            )
          })
          await fetchDigiflazzSyncStatus()
          return
        }
        throw new Error(
          getPayloadError(startPayload, 'Proses sinkronisasi gagal dimulai.')
        )
      }

      const jobID = startPayload?.job_id
      if (!jobID) {
        throw new Error('Backend tidak mengembalikan ID sinkronisasi.')
      }

      const pollingDeadline = Date.now() + 15 * 60 * 1000
      while (Date.now() < pollingDeadline) {
        await new Promise(resolve => window.setTimeout(resolve, 750))
        if (pollRunID !== syncPollRunIDRef.current) return

        const statusResponse = await get(
          `/admin/products/sync-jobs/${encodeURIComponent(jobID)}`
        )
        const statusPayload = await readJSONPayload(statusResponse) as ProductSyncJobPayload | null
        if (pollRunID !== syncPollRunIDRef.current) return
        if (!statusResponse.ok) {
          throw new Error(
            getPayloadError(statusPayload, 'Status sinkronisasi gagal dimuat.')
          )
        }

        setSyncProgress(
          typeof statusPayload?.progress === 'number'
            ? Math.min(100, Math.max(0, statusPayload.progress))
            : 0
        )
        setSyncStage(statusPayload?.stage || 'Sinkronisasi sedang berjalan')
        setSyncProcessed(statusPayload?.processed || 0)
        setSyncTotal(statusPayload?.total || 0)

        if (statusPayload?.status === 'failed') {
          await fetchDigiflazzSyncStatus()
          throw new Error(statusPayload.error || 'Sinkronisasi produk gagal.')
        }
        if (statusPayload?.status === 'completed') {
          await fetchAllData()
          await fetchDigiflazzSyncStatus()
          setSyncFeedback({
            type: 'success',
            message: 'Sinkronisasi produk Digiflazz berhasil.'
          })
          return
        }
      }

      throw new Error('Sinkronisasi melewati batas waktu 15 menit.')
    } catch (error) {
      console.error("Error pas sync:", error)
      setSyncFeedback({
        type: 'error',
        message: error instanceof Error
          ? error.message
          : 'Terjadi kesalahan jaringan saat Sync.'
      })
      await fetchDigiflazzSyncStatus()
    } finally {
      if (pollRunID === syncPollRunIDRef.current) {
        setIsSyncing(false)
      }
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

  const runProductGroupMutation = async (
    operation: () => Promise<void>
  ) => {
    if (productGroupMutationLockRef.current) {
      throw new Error('Perubahan kelompok lain masih diproses.')
    }

    productGroupMutationLockRef.current = true
    setIsProductGroupMutating(true)

    try {
      await operation()
    } finally {
      productGroupMutationLockRef.current = false
      setIsProductGroupMutating(false)
    }
  }

  const handleCreateProductGroup = async (input: ProductGroupInput) => {
    const catalogCardCode = activeCatalog
    if (catalogCardCode === 'all') {
      throw new Error('Pilih satu katalog sebelum membuat kelompok.')
    }

    await runProductGroupMutation(async () => {
      const response = await post(
        `/admin/catalogs/${encodeURIComponent(catalogCardCode)}/product-groups`,
        input
      )
      const payload = await readJSONPayload(response)

      if (!response.ok) {
        throw new Error(
          getPayloadError(payload, 'Kelompok produk gagal dibuat.')
        )
      }

      await fetchProductGroups(catalogCardCode)
    })
  }

  const handleUpdateProductGroup = async (
    groupID: number,
    input: ProductGroupInput
  ) => {
    const catalogCardCode = activeCatalog
    if (catalogCardCode === 'all') {
      throw new Error('Pilih satu katalog sebelum mengubah kelompok.')
    }

    await runProductGroupMutation(async () => {
      const response = await patch(`/admin/product-groups/${groupID}`, input)
      const payload = await readJSONPayload(response)

      if (!response.ok) {
        throw new Error(
          getPayloadError(payload, 'Kelompok produk gagal diperbarui.')
        )
      }

      await fetchProductGroups(catalogCardCode)
    })
  }

  const handleDeleteProductGroup = async (group: ProductGroup) => {
    const catalogCardCode = activeCatalog
    if (
      catalogCardCode === 'all' ||
      group.catalog_cardcode !== catalogCardCode
    ) {
      throw new Error('Kelompok tidak cocok dengan katalog yang sedang dibuka.')
    }

    await runProductGroupMutation(async () => {
      const response = await deleteRequest(`/admin/product-groups/${group.ID}`)
      const payload = await readJSONPayload(response)

      if (!response.ok) {
        throw new Error(
          getPayloadError(payload, 'Kelompok produk gagal dihapus.')
        )
      }

      if (activeGroupFilter === group.ID) {
        setActiveGroupFilter('ungrouped')
      }

      await Promise.all([
        fetchAllData(),
        fetchProductGroups(catalogCardCode)
      ])
    })
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

  const handleCatalogChange = (catalogCardCode: string) => {
    productGroupRequestIDRef.current += 1
    activeCatalogRef.current = catalogCardCode
    setActiveCatalog(catalogCardCode)
    setActiveGroupFilter('all')
    setProductGroups([])
    setProductGroupsLoadError(null)
    setProductGroupsLoading(catalogCardCode !== 'all')
  }

  const handleCategoryChange = (catId: string) => {
    setActiveCategory(catId)
    handleCatalogChange('all')
  }

  const productGroupByID = useMemo(
    () => new Map(productGroups.map(group => [group.ID, group])),
    [productGroups]
  )

  const activeCatalogProducts = useMemo(
    () => activeCatalog === 'all'
      ? []
      : products.filter(
          product => getProductCatalogCode(product) === activeCatalog
        ),
    [activeCatalog, products]
  )

  const groupProductCounts = useMemo(() => {
    const counts: Record<number, number> = {}

    activeCatalogProducts.forEach(product => {
      const groupID = getProductGroupID(product)
      if (groupID !== null) {
        counts[groupID] = (counts[groupID] ?? 0) + 1
      }
    })

    productGroups.forEach(group => {
      if (counts[group.ID] === undefined) {
        counts[group.ID] =
          group.product_count ?? group.products?.length ?? 0
      }
    })

    return counts
  }, [activeCatalogProducts, productGroups])

  const ungroupedProductCount = useMemo(
    () => activeCatalogProducts.filter(
      product => getProductGroupID(product) === null
    ).length,
    [activeCatalogProducts]
  )

  const displayedProducts = useMemo(() => {
    return products.filter(p => {
      const pCatalogCode = getProductCatalogCode(p)
      const catalogInfo = catalogs.find(c => c.cardcode === pCatalogCode)
      const productGroupID = getProductGroupID(p)

      const matchCategory = activeCategory === 'all' || catalogInfo?.category_id === activeCategory || !catalogInfo?.category_id
      const matchCatalog = activeCatalog === 'all' || pCatalogCode === activeCatalog
      const matchGroup = activeGroupFilter === 'all' ||
        (activeGroupFilter === 'ungrouped'
          ? productGroupID === null
          : productGroupID === activeGroupFilter)
      const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (p.code && p.code.toLowerCase().includes(searchTerm.toLowerCase()))

      return matchCategory && matchCatalog && matchGroup && matchSearch
    })
  }, [
    products,
    catalogs,
    activeCategory,
    activeCatalog,
    activeGroupFilter,
    searchTerm
  ])

  const displayedProductIDs = useMemo(
    () => displayedProducts.map(product => product.ID),
    [displayedProducts]
  )
  const selectedItemSet = useMemo(
    () => new Set(selectedItems),
    [selectedItems]
  )
  const selectedProducts = useMemo(
    () => products.filter(product => selectedItemSet.has(product.ID)),
    [products, selectedItemSet]
  )
  const selectedCatalogCodes = useMemo(
    () => new Set(
      selectedProducts.map(getProductCatalogCode).filter(Boolean)
    ),
    [selectedProducts]
  )
  const groupAssignmentIssue = useMemo(() => {
    if (activeCatalog === 'all') {
      return 'Pilih satu katalog untuk memasukkan produk ke kelompok.'
    }
    if (selectedProducts.length !== selectedItems.length) {
      return 'Sebagian produk terpilih sudah tidak tersedia. Muat ulang inventory.'
    }
    if (
      selectedCatalogCodes.size !== 1 ||
      !selectedCatalogCodes.has(activeCatalog)
    ) {
      return 'Semua produk terpilih harus berasal dari katalog yang sedang dibuka.'
    }

    return null
  }, [
    activeCatalog,
    selectedCatalogCodes,
    selectedItems.length,
    selectedProducts.length
  ])
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
    if (isBulkActionLoading || isGroupAssignmentLoading) return
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

  const showAssignProductGroupDialog = () => {
    setEditingProduct(null)
    setAssignmentGroupValue('')
    setBulkFeedback(null)

    if (groupAssignmentIssue) {
      setBulkFeedback({
        type: 'error',
        message: groupAssignmentIssue
      })
      return
    }

    setBulkDialog('group')
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

  const handleAssignProductGroup = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()

    if (
      groupAssignmentLockRef.current ||
      selectedItems.length === 0
    ) return

    if (groupAssignmentIssue) {
      setBulkFeedback({ type: 'error', message: groupAssignmentIssue })
      return
    }

    if (!assignmentGroupValue) {
      setBulkFeedback({
        type: 'error',
        message: 'Pilih kelompok tujuan atau Belum dikelompokkan.'
      })
      return
    }

    const catalogCardCode = activeCatalog
    const productIDs = [...selectedItems]
    let endpoint = '/admin/product-groups/unassign-products'
    let targetLabel = 'Belum dikelompokkan'

    if (assignmentGroupValue !== 'ungrouped') {
      const groupID = Number(assignmentGroupValue)
      const targetGroup = productGroups.find(group => group.ID === groupID)

      if (
        !Number.isInteger(groupID) ||
        !targetGroup ||
        targetGroup.catalog_cardcode !== catalogCardCode
      ) {
        setBulkFeedback({
          type: 'error',
          message: 'Kelompok tujuan tidak valid untuk katalog ini.'
        })
        return
      }

      endpoint = `/admin/product-groups/${groupID}/products`
      targetLabel = targetGroup.name
    }

    groupAssignmentLockRef.current = true
    setIsGroupAssignmentLoading(true)
    setBulkFeedback(null)

    try {
      const response = await post(endpoint, { product_ids: productIDs })
      const payload = await readJSONPayload(response)

      if (!response.ok) {
        throw new Error(
          getPayloadError(payload, 'Pengelompokan produk gagal.')
        )
      }

      const result = payload as Partial<BulkMutationResult> | null
      const requested = result?.requested ?? productIDs.length
      const matched = result?.matched ?? requested
      const updated = result?.updated ?? matched
      const missingCount = Math.max(0, requested - matched)

      setBulkFeedback({
        type: 'success',
        message: missingCount > 0
          ? `${updated} produk dipindahkan ke ${targetLabel}; ${missingCount} produk tidak ditemukan.`
          : `${updated} produk berhasil dipindahkan ke ${targetLabel}.`
      })
      setBulkDialog(null)
      setSelectedItems([])

      await Promise.all([
        fetchAllData(),
        fetchProductGroups(catalogCardCode)
      ])
    } catch (error) {
      setBulkFeedback({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Pengelompokan produk gagal.'
      })
    } finally {
      groupAssignmentLockRef.current = false
      setIsGroupAssignmentLoading(false)
    }
  }

  const totalActive = products.filter(p => p.is_active).length
  const totalIssues = products.filter(p => !p.is_active || p.stock === 0).length
  const activeCatalogInfo = activeCatalog === 'all'
    ? null
    : catalogs.find(catalog => catalog.cardcode === activeCatalog) ?? null

  const changeActiveTab = (tab: 'live' | 'pending') => {
    setActiveTab(tab)
    setSelectedItems([])
    setBulkDialog(null)
    setEditingProduct(null)
    setBulkFeedback(null)
    setSyncFeedback(null)
  }

  const isDigiflazzRunning = digiflazzSyncStatus?.running === true
  const isDigiflazzCooldown = syncRetryAfter > 0
  const isDigiflazzSyncDisabled =
    isSyncing || isDigiflazzRunning || isDigiflazzCooldown
  const syncButtonLabel = isSyncing || (
    isDigiflazzRunning && digiflazzSyncStatus?.source === 'manual'
  )
    ? 'Sync Digiflazz berjalan...'
    : isDigiflazzRunning && digiflazzSyncStatus?.source === 'cron'
      ? 'Cron Digiflazz berjalan...'
      : isDigiflazzCooldown
        ? `Tunggu ${formatSyncCountdown(syncRetryAfter)}`
        : 'Sync Digiflazz'
  const syncStatusHelper =
    isDigiflazzRunning && digiflazzSyncStatus?.source === 'cron'
      ? 'Sinkronisasi otomatis sedang mengambil price list.'
      : isDigiflazzCooldown
        ? `Sync tersedia lagi dalam ${formatSyncCountdown(syncRetryAfter)}.`
        : digiflazzSyncStatus?.last_success_at
          ? `Terakhir berhasil: ${new Date(digiflazzSyncStatus.last_success_at).toLocaleString('id-ID')}.`
          : null

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
                  onClick={() => handleCatalogChange('all')}
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
                        onClick={() => handleCatalogChange(cat.cardcode)}
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

            {activeCatalogInfo ? (
              <ProductGroupManager
                catalog={{
                  cardcode: activeCatalogInfo.cardcode,
                  name: activeCatalogInfo.name,
                  markup_percent: activeCatalogInfo.markup_percent
                }}
                groups={productGroups}
                loading={productGroupsLoading}
                isMutating={isProductGroupMutating}
                loadError={productGroupsLoadError}
                activeFilter={activeGroupFilter}
                totalCount={activeCatalogProducts.length}
                ungroupedCount={ungroupedProductCount}
                groupProductCounts={groupProductCounts}
                onFilterChange={setActiveGroupFilter}
                onCreate={handleCreateProductGroup}
                onUpdate={handleUpdateProductGroup}
                onDelete={handleDeleteProductGroup}
                onRefresh={() => fetchProductGroups(activeCatalog)}
              />
            ) : (
              <div className="flex items-start gap-3 rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.018] px-4 py-3 text-xs leading-5 text-white/40">
                <FolderTree size={16} className="mt-0.5 shrink-0 text-fuchsia-200/55" />
                Pilih satu katalog di atas untuk membuat kelompok, mengatur urutan,
                dan melihat produk yang belum dikelompokkan.
              </div>
            )}

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
                    onClick={() => void handleSyncAPI()}
                    disabled={isDigiflazzSyncDisabled}
                    className={`flex-1 md:flex-none px-6 py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all font-bold text-sm border
                      ${isDigiflazzSyncDisabled
                        ? 'bg-[#0084FF]/5 border-[#0084FF]/10 text-[#0084FF]/50 cursor-not-allowed'
                        : 'bg-[#0084FF]/10 border-[#0084FF]/30 text-[#0084FF] hover:bg-[#0084FF]/20'
                      }`}
                  >
                    {isSyncing || isDigiflazzRunning
                      ? <RefreshCw size={18} className="animate-spin" />
                      : <Zap size={18} />}
                    <span>{syncButtonLabel}</span>
                  </button>
                )}
              </div>
            </div>

            {syncStatusHelper && (
              <p className="mt-2 text-xs text-white/45" role="status" aria-live="polite">
                {syncStatusHelper}
              </p>
            )}

            {syncFeedback && (
              <div className="mt-3">
                <BulkFeedbackBanner
                  feedback={syncFeedback}
                  onDismiss={() => setSyncFeedback(null)}
                />
              </div>
            )}

            {isSyncing && (
              <div
                role="status"
                aria-live="polite"
                className="rounded-2xl border border-[#0084FF]/20 bg-[#0084FF]/[0.055] px-4 py-3"
              >
                <div className="flex items-center justify-between gap-4 text-[11px]">
                  <span className="font-medium text-sky-100/75">
                    {syncStage}
                  </span>
                  <span className="shrink-0 font-mono text-[#0084FF]">
                    {syncTotal > 0
                      ? `${syncProcessed}/${syncTotal} · ${syncProgress}%`
                      : `${syncProgress}%`}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/30">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#0084FF] to-fuchsia-400 transition-[width] duration-500"
                    style={{ width: `${syncProgress}%` }}
                  />
                </div>
              </div>
            )}
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
              className="sticky top-0 z-40 mb-4 rounded-3xl border border-white/[0.08] bg-black/[0.035] p-4 backdrop-blur-md backdrop-saturate-150 sm:p-5"
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
                    {groupAssignmentIssue && (
                      <p className="mt-1 text-xs text-amber-200/65">
                        {groupAssignmentIssue}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={
                      isBulkActionLoading ||
                      isGroupAssignmentLoading ||
                      productGroupsLoading ||
                      Boolean(groupAssignmentIssue)
                    }
                    onClick={showAssignProductGroupDialog}
                    title={groupAssignmentIssue || undefined}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-fuchsia-300/25 bg-fuchsia-400/[0.1] px-3.5 text-xs font-semibold text-fuchsia-100 transition-colors hover:bg-fuchsia-400/[0.18] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300/70 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <FolderTree size={15} /> Masukkan ke kelompok
                  </button>
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
                      <Checkbox
                        isSelected={allDisplayedSelected}
                        isIndeterminate={someDisplayedSelected}
                        isDisabled={displayedProductIDs.length === 0}
                        aria-label={
                          allDisplayedSelected
                            ? 'Hapus pilihan semua produk yang sedang tampil'
                            : 'Pilih semua produk yang sedang tampil'
                        }
                        onChange={toggleAllDisplayedProducts}
                      />
                    </th>
                    <th className="px-3 text-[11px] font-bold uppercase tracking-widest text-white/40">Product</th>
                    <th className="w-[17%] px-3 text-[11px] font-bold uppercase tracking-widest text-white/40">Provider / SKU</th>
                    <th className="w-[13%] px-3 text-right text-[11px] font-bold uppercase tracking-widest text-white/40">Harga</th>
                    <th className="w-[12%] px-3 text-right text-[11px] font-bold uppercase tracking-widest text-white/40">Harga Coret</th>
                    <th className="w-[8%] px-2 text-center text-[11px] font-bold uppercase tracking-widest text-white/40">Stock</th>
                    <th className="w-[16%] px-2 text-center text-[11px] font-bold uppercase tracking-widest text-white/40">Status</th>
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
                        <td className="px-3"><div className="ml-auto h-3 w-3/4 rounded bg-white/5" /></td>
                        <td className="px-2"><div className="mx-auto h-4 w-10 rounded bg-white/5" /></td>
                        <td className="px-2"><div className="mx-auto mb-1 h-6 w-24 rounded-xl bg-white/5" /><div className="mx-auto h-6 w-20 rounded-xl bg-white/5" /></td>
                        <td className="pr-2"><div className="ml-auto h-9 w-9 rounded-xl bg-white/5" /></td>
                      </tr>
                    ))
                  ) : displayedProducts.length > 0 ? (
                    displayedProducts.map((p) => {
                      const isSelected = selectedItems.includes(p.ID);
                      const pCatalogCode = getProductCatalogCode(p);
                      const catalogInfo = catalogs.find(c => c.cardcode === pCatalogCode);
                      const productGroupID = getProductGroupID(p);
                      const productGroupInfo = productGroupID === null
                        ? null
                        : productGroupByID.get(productGroupID) ?? p.product_group;

                      return (
                        <tr key={p.ID} className={`group h-[88px] border-b border-white/5 transition-colors hover:bg-white/[0.035] ${isSelected ? 'bg-[#0084FF]/[0.045]' : ''}`}>
                          <td className="py-4 pl-2">
                            <Checkbox
                              isSelected={isSelected}
                              aria-label={`${isSelected ? 'Hapus pilihan' : 'Pilih'} ${p.name}`}
                              onChange={() => toggleProductSelection(p.ID)}
                            />
                          </td>
                          <td className="px-3 align-middle">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="shrink-0"><ProductTableThumbnail imageUrl={p.image_url} productName={p.name} /></div>
                              <div className="min-w-0">
                                <p className="line-clamp-2 font-sans text-sm font-bold leading-5 text-white/90">{p.name}</p>
                                <div className="mt-1 flex max-w-full flex-wrap gap-1">
                                  <span className="inline-flex max-w-full truncate rounded bg-white/5 px-1.5 py-0.5 text-[9px] uppercase text-white/40">
                                    {catalogInfo?.name || pCatalogCode || 'UNKNOWN'}
                                  </span>
                                  <span className={`inline-flex max-w-full truncate rounded px-1.5 py-0.5 text-[9px] ${
                                    productGroupInfo
                                      ? 'bg-fuchsia-400/[0.08] text-fuchsia-200/65'
                                      : 'bg-amber-400/[0.08] text-amber-200/65'
                                  }`}>
                                    {productGroupInfo?.name || 'Belum dikelompokkan'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 align-middle">
                            <p className="truncate font-sans text-[11px] uppercase tracking-wider text-white/50">{p.provider || '-'}</p>
                            <p className="mt-1 truncate font-mono text-[11px] font-medium uppercase tracking-wider text-[#0084FF]" title={p.code}>{p.code || '-'}</p>
                          </td>
                          <td className="px-3 text-right">
                            <p className="truncate font-mono text-xs font-bold text-white">Rp {getProductSellingPrice(p).toLocaleString('id-ID')}</p>
                            <p className="mt-1 truncate text-[10px] text-white/40">Modal Rp {p.price.toLocaleString()}</p>
                          </td>
                          <td className="px-3 text-right">
                            {p.original_price !== null && p.original_price !== undefined ? (
                              <p className="truncate font-mono text-[11px] text-white/45 line-through">
                                Rp {p.original_price.toLocaleString('id-ID')}
                              </p>
                            ) : (
                              <span className="text-xs text-white/20">—</span>
                            )}
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
                      <td colSpan={8} className="py-20 text-center text-white/40 font-mono text-sm">
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
                  <Checkbox
                    isSelected={allDisplayedSelected}
                    isIndeterminate={someDisplayedSelected}
                    isDisabled={displayedProductIDs.length === 0}
                    aria-label={allDisplayedSelected ? 'Hapus pilihan semua produk yang sedang tampil' : 'Pilih semua produk yang sedang tampil'}
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
                    const pCatalogCode = getProductCatalogCode(p)
                    const catalogInfo = catalogs.find(c => c.cardcode === pCatalogCode)
                    const productGroupID = getProductGroupID(p)
                    const productGroupInfo = productGroupID === null
                      ? null
                      : productGroupByID.get(productGroupID) ?? p.product_group

                    return (
                      <article key={p.ID} className={`group rounded-2xl border p-4 transition-colors ${isSelected ? 'border-[#0084FF]/25 bg-[#0084FF]/[0.045]' : 'border-white/5 bg-white/[0.025]'}`}>
                        <div className="flex items-start gap-3">
                          <div className="pt-3">
                            <Checkbox isSelected={isSelected} aria-label={`${isSelected ? 'Hapus pilihan' : 'Pilih'} ${p.name}`} onChange={() => toggleProductSelection(p.ID)} />
                          </div>
                          <ProductTableThumbnail imageUrl={p.image_url} productName={p.name} />
                          <div className="min-w-0 flex-1">
                            <h3 className="line-clamp-2 text-sm font-bold leading-5 text-white/90">{p.name}</h3>
                            <div className="mt-1 flex flex-wrap gap-1">
                              <span className="inline-flex max-w-full truncate rounded bg-white/5 px-1.5 py-0.5 text-[9px] uppercase text-white/40">{catalogInfo?.name || pCatalogCode || 'UNKNOWN'}</span>
                              <span className={`inline-flex max-w-full truncate rounded px-1.5 py-0.5 text-[9px] ${
                                productGroupInfo
                                  ? 'bg-fuchsia-400/[0.08] text-fuchsia-200/65'
                                  : 'bg-amber-400/[0.08] text-amber-200/65'
                              }`}>
                                {productGroupInfo?.name || 'Belum dikelompokkan'}
                              </span>
                            </div>
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
                            <dd className="mt-1 truncate font-mono font-bold text-white">Rp {getProductSellingPrice(p).toLocaleString('id-ID')}</dd>
                            <dd className="mt-1 truncate text-[10px] text-white/35">
                              Coret{' '}
                              {p.original_price !== null && p.original_price !== undefined ? (
                                <span className="line-through">Rp {p.original_price.toLocaleString('id-ID')}</span>
                              ) : '—'}
                            </dd>
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
                <Checkbox
                  isSelected={bulkEditForm.applyStatus}
                  onChange={isSelected =>
                    setBulkEditForm(current => ({
                      ...current,
                      applyStatus: isSelected
                    }))
                  }
                  className="items-start"
                >
                  <span>
                    <span className="block text-sm font-semibold text-white">
                      Terapkan perubahan status storefront
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-white/40">
                      Status provider tetap dikelola otomatis oleh sinkronisasi.
                    </span>
                  </span>
                </Checkbox>

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
                <Checkbox
                  isSelected={bulkEditForm.applyCatalog}
                  onChange={isSelected =>
                    setBulkEditForm(current => ({
                      ...current,
                      applyCatalog: isSelected
                    }))
                  }
                  className="items-start"
                >
                  <span>
                    <span className="block text-sm font-semibold text-white">
                      Terapkan perubahan katalog
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-white/40">
                      Produk akan dipindahkan memakai cardcode katalog tujuan
                      dan kelompok lamanya akan dilepas.
                    </span>
                  </span>
                </Checkbox>

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
                <Checkbox
                  isSelected={bulkEditForm.applyImage}
                  onChange={isSelected =>
                    setBulkEditForm(current => ({
                      ...current,
                      applyImage: isSelected
                    }))
                  }
                  className="items-start"
                >
                  <span>
                    <span className="block text-sm font-semibold text-white">
                      Terapkan thumbnail yang sama
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-white/40">
                      URL ini akan mengganti thumbnail seluruh produk yang dipilih.
                    </span>
                  </span>
                </Checkbox>

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
              berubah. Kelompok lama akan dilepas dan produk menjadi Belum
              dikelompokkan di katalog tujuan.
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

      {bulkDialog === 'group' && (
        <BulkModal
          title="Masukkan ke kelompok"
          description={`${selectedItems.length} produk dari ${activeCatalogInfo?.name || activeCatalog} akan diperbarui kelompoknya.`}
          titleId="bulk-product-group-title"
          onClose={closeBulkDialog}
          isBusy={isGroupAssignmentLoading}
        >
          <form onSubmit={handleAssignProductGroup} className="mt-7 space-y-5">
            {bulkFeedback?.type === 'error' && (
              <BulkFeedbackBanner feedback={bulkFeedback} />
            )}

            <label className="block text-xs font-medium text-white/60">
              Kelompok tujuan
              <select
                value={assignmentGroupValue}
                disabled={isGroupAssignmentLoading || productGroupsLoading}
                onChange={event => setAssignmentGroupValue(event.target.value)}
                className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-[#0b0e16] px-4 text-sm text-white outline-none focus:border-fuchsia-400/60 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <option value="">Pilih kelompok</option>
                <option value="ungrouped">Belum dikelompokkan</option>
                {productGroups.map(group => (
                  <option key={group.ID} value={String(group.ID)}>
                    {group.name}{group.is_active ? '' : ' (nonaktif)'}
                  </option>
                ))}
              </select>
            </label>

            {productGroups.length === 0 && !productGroupsLoading && (
              <p className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.055] px-4 py-3 text-xs leading-5 text-amber-100/65">
                Belum ada kelompok di katalog ini. Tutup dialog lalu buat
                kelompok baru, atau pilih Belum dikelompokkan.
              </p>
            )}

            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] px-4 py-3 text-xs leading-5 text-white/45">
              Semua produk terpilih telah diverifikasi berasal dari katalog{' '}
              <strong className="text-white/75">
                {activeCatalogInfo?.name || activeCatalog}
              </strong>. Memilih kelompok lain akan memindahkan produk dari
              kelompok lamanya.
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                disabled={isGroupAssignmentLoading}
                onClick={closeBulkDialog}
                className="min-h-11 rounded-full border border-white/10 px-5 text-sm text-white/55 hover:bg-white/5 disabled:opacity-40"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={
                  isGroupAssignmentLoading ||
                  productGroupsLoading ||
                  !assignmentGroupValue
                }
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-fuchsia-300/30 bg-fuchsia-400/[0.14] px-6 text-sm font-semibold text-fuchsia-100 transition-colors hover:bg-fuchsia-400/[0.22] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isGroupAssignmentLoading && (
                  <Loader2 size={16} className="animate-spin" />
                )}
                Simpan kelompok {selectedItems.length} produk
              </button>
            </div>
          </form>
        </BulkModal>
      )}

    </main>
  )
}
