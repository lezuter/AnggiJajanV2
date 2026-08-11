'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import Navbar from '@/components/Navbar'
import PaymentModal from '@/components/PaymentModal'
import SiteFooter from '@/components/SiteFooter'
import AccountTargetFields from '@/components/game-purchase/AccountTargetFields'
import CheckoutStepper from '@/components/game-purchase/CheckoutStepper'
import GamePurchaseHero from '@/components/game-purchase/GamePurchaseHero'
import OrderSummary from '@/components/game-purchase/OrderSummary'
import ConfirmationModal from '@/components/game-purchase/ConfirmationModal'
import PaymentMethodSelector, {
  type PaymentMethodOption
} from '@/components/game-purchase/PaymentMethodSelector'
import ProductSelector, {
  type PurchaseProduct,
  type PurchaseProductSection
} from '@/components/game-purchase/ProductSelector'
import CyberneticGridShader from '@/components/ui/cybernetic-grid-shader'
import { findPublicCatalog, PublicCatalog } from '@/data/publicCatalogs'
import { prepareMidtransSnap } from '@/lib/midtransSnap'
import { getProductStartingPrice } from '@/lib/pricing'
import QuantitySelector from '@/components/game-purchase/QuantitySelector'
import ContactInfo from '@/components/game-purchase/ContactInfo'
import PromoCodeInput from '@/components/game-purchase/PromoCodeInput'

type Product = PurchaseProduct

interface CatalogMetadata {
  ID?: number
  name: string
  slug: string
  image_url?: string
  banner_url?: string
  category: string
  publisher?: string
  region?: string
  short_name?: string
  check_id_code?: string
  description?: string
  accent?: string
  shortName?: string
}

interface ProductGroup {
  ID: number
  name: string
  catalog_cardcode: string
  sort_order?: number
  is_active?: boolean
  products?: Product[]
}

interface CatalogResponse extends CatalogMetadata {
  products?: Product[]
  product_groups?: ProductGroup[]
}

interface Catalog extends CatalogMetadata {
  productSections: PurchaseProductSection[]
}

interface CheckoutData {
  snap_token?: string
  redirect_url?: string
  invoice_id?: string
  merchant_ref?: string
  merchant_order_id?: string
  reference?: string
  checkout_url?: string
  payment_url?: string
  app_url?: string
  va_number?: string
  qr_string?: string
  amount?: number
  base_price?: number
  customer_surcharge?: number
  estimated_fee?: number
  payment_method?: string
  payment_name?: string
  payment_provider?: string
}

interface PaymentMethodsResponse {
  payment_provider: string
  fee_bearer: string
  product_amount: number
  starting_price: number
  minimum_transaction_amount?: number
  methods: PaymentMethodOption[]
}

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
).replace(/\/+$/, '')

const PURCHASES_ENABLED = process.env.NEXT_PUBLIC_PURCHASES_ENABLED === 'true'

const toPreviewCatalog = (catalog: PublicCatalog): Catalog => ({
  name: catalog.name,
  slug: catalog.slug,
  category: catalog.category,
  description: catalog.description,
  accent: catalog.accent,
  shortName: catalog.shortName,
  productSections: []
})

const normalizeProducts = (products: Product[] = [], checkIdCode?: string) => {
  const normalizedCheckCode = checkIdCode?.trim().toLowerCase()
  const safeProducts = Array.isArray(products) ? products : []

  return [...safeProducts]
    .filter(product => {
      const name = product.name.trim().toLowerCase()
      const code = product.code.trim().toLowerCase()

      const isCheckerProduct =
        Boolean(normalizedCheckCode && code === normalizedCheckCode) ||
        name.includes('checker') ||
        code.includes('checker') ||
        name.includes('cek username') ||
        name.includes('cek nickname') ||
        name.includes('cek id')

      const hasStock =
        product.stock === undefined || product.stock === -1 || product.stock > 0

      return (
        product.is_active !== false &&
        product.admin_enabled !== false &&
        !isCheckerProduct &&
        hasStock
      )
    })
    .sort((a, b) => {
      const sortOrderDifference = (a.sort_order ?? 0) - (b.sort_order ?? 0)

      if (sortOrderDifference !== 0) {
        return sortOrderDifference
      }

      const priceDifference =
        getProductStartingPrice(a) - getProductStartingPrice(b)

      if (priceDifference !== 0) {
        return priceDifference
      }

      return a.name.localeCompare(b.name)
    })
}

const buildProductSections = (
  groups: ProductGroup[] = [],
  ungroupedProducts: Product[] = [],
  checkIdCode?: string
): PurchaseProductSection[] => {
  const safeGroups = Array.isArray(groups) ? groups : []
  const nestedProductIds = new Set<number>()

  safeGroups.forEach(group => {
    if (!Array.isArray(group.products)) return

    group.products.forEach(product => {
      if (typeof product?.ID === 'number') {
        nestedProductIds.add(product.ID)
      }
    })
  })

  const sections = [...safeGroups]
    .filter(group => group.is_active !== false)
    .sort((a, b) => {
      const sortOrderDifference = (a.sort_order ?? 0) - (b.sort_order ?? 0)

      if (sortOrderDifference !== 0) {
        return sortOrderDifference
      }

      const nameDifference = a.name.localeCompare(b.name)
      return nameDifference !== 0 ? nameDifference : a.ID - b.ID
    })
    .map(group => ({
      key: `group-${group.ID}`,
      title: group.name.trim() || 'Produk',
      products: normalizeProducts(group.products, checkIdCode)
    }))

  const normalizedUngroupedProducts = normalizeProducts(
    Array.isArray(ungroupedProducts) ? ungroupedProducts : [],
    checkIdCode
  ).filter(
    product =>
      product.product_group_id == null && !nestedProductIds.has(product.ID)
  )

  if (normalizedUngroupedProducts.length > 0) {
    sections.push({
      key: 'ungrouped',
      title: 'Belum dikelompokkan',
      products: normalizedUngroupedProducts
    })
  }

  return sections
}

const formatIDR = (value?: number) =>
  typeof value === 'number'
    ? new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0
      }).format(value)
    : 'Belum tersedia saat layanan dibuka'

const summaryRows = (
  gameName: string,
  selectedProduct: Product | null,
  selectedTarget: string,
  quantity: number
) => [
  ['Game', gameName],
  [
    'Produk',
    selectedProduct
      ? quantity > 1
        ? `${selectedProduct.name} (${quantity}x)`
        : selectedProduct.name
      : '-'
  ],
  ['Target', selectedTarget || '-']
]

export default function GameDetailClient ({ slug }: { slug: string }) {
  const router = useRouter()
  const publicCatalog = useMemo(() => findPublicCatalog(slug), [slug])
  const userIdRef = useRef<HTMLInputElement>(null)
  const zoneIdRef = useRef<HTMLInputElement>(null)
  const accountSectionRef = useRef<HTMLDivElement>(null)
  const quantitySectionRef = useRef<HTMLDivElement>(null) // Ref untuk modul Jumlah Pembelian
  const paymentSectionRef = useRef<HTMLDivElement>(null)
  const focusTimerRef = useRef<number | null>(null)
  const attentionTimerRef = useRef<number | null>(null)
  const scrollTimerRef = useRef<number | null>(null)

  const [game, setGame] = useState<Catalog | null>(
    !PURCHASES_ENABLED && publicCatalog ? toPreviewCatalog(publicCatalog) : null
  )
  const [loading, setLoading] = useState(PURCHASES_ENABLED)
  const [loadError, setLoadError] = useState('')

  const [userId, setUserId] = useState('')
  const [zoneId, setZoneId] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  const [quantity, setQuantity] = useState(1)
  const [contactInfo, setContactInfo] = useState('')
  const [promoCode, setPromoCode] = useState('')

  const [accountWarning, setAccountWarning] = useState(false)
  const [accountAttention, setAccountAttention] = useState(false)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOption[]>(
    []
  )
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(false)
  const [paymentMethodsError, setPaymentMethodsError] = useState('')
  const [selectedQuoteKey, setSelectedQuoteKey] = useState('')
  const [paymentMethodsRefreshKey, setPaymentMethodsRefreshKey] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [transactionData, setTransactionData] = useState<CheckoutData | null>(
    null
  )

  useEffect(() => {
    if (focusTimerRef.current !== null) {
      window.clearTimeout(focusTimerRef.current)
      focusTimerRef.current = null
    }

    if (attentionTimerRef.current !== null) {
      window.clearTimeout(attentionTimerRef.current)
      attentionTimerRef.current = null
    }

    if (scrollTimerRef.current !== null) {
      window.clearTimeout(scrollTimerRef.current)
      scrollTimerRef.current = null
    }

    setSelectedProduct(null)
    setQuantity(1)
    setContactInfo('')
    setPromoCode('')
    setAccountWarning(false)
    setAccountAttention(false)
    setPaymentMethods([])
    setPaymentMethodsLoading(false)
    setPaymentMethodsError('')
    setSelectedQuoteKey('')
    setPaymentMethodsRefreshKey(0)
    setShowConfirmModal(false)
    setShowModal(false)
    setTransactionData(null)
  }, [slug])

  useEffect(() => {
    return () => {
      if (focusTimerRef.current !== null) {
        window.clearTimeout(focusTimerRef.current)
      }

      if (attentionTimerRef.current !== null) {
        window.clearTimeout(attentionTimerRef.current)
      }

      if (scrollTimerRef.current !== null) {
        window.clearTimeout(scrollTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const fetchGameData = async () => {
      const previewCatalog =
        !PURCHASES_ENABLED && publicCatalog
          ? toPreviewCatalog(publicCatalog)
          : null

      if (!PURCHASES_ENABLED) {
        setGame(previewCatalog)
        setLoading(!previewCatalog)
      } else {
        setLoading(true)
      }

      setLoadError('')

      try {
        const res = await fetch(`${API_BASE_URL}/catalogs/${slug}`, {
          cache: 'no-store'
        })

        if (!res.ok) {
          throw new Error('Katalog game belum bisa dimuat.')
        }

        const data = (await res.json()) as CatalogResponse
        const productSections = buildProductSections(
          data.product_groups,
          data.products,
          data.check_id_code
        )

        setGame({
          name: data.name ?? previewCatalog?.name ?? '',
          slug: data.slug ?? previewCatalog?.slug ?? slug,
          image_url: data.image_url ?? previewCatalog?.image_url,
          banner_url: data.banner_url ?? previewCatalog?.banner_url,
          category: data.category ?? previewCatalog?.category ?? '',
          publisher: data.publisher,
          region: data.region,
          description: data.description?.trim()
            ? data.description
            : previewCatalog?.description,
          accent: data.accent ?? previewCatalog?.accent,
          short_name: data.short_name,
          shortName:
            data.short_name?.trim() ||
            data.shortName?.trim() ||
            previewCatalog?.shortName,
          check_id_code: data.check_id_code,
          productSections
        })
      } catch (error) {
        if (!previewCatalog) {
          setLoadError(
            error instanceof Error
              ? error.message
              : 'Katalog game belum bisa dimuat.'
          )
        }
      } finally {
        setLoading(false)
      }
    }

    fetchGameData()
  }, [publicCatalog, slug])

  useEffect(() => {
    if (!PURCHASES_ENABLED || !selectedProduct) {
      setPaymentMethods([])
      setPaymentMethodsLoading(false)
      setPaymentMethodsError('')
      setSelectedQuoteKey('')
      return
    }

    const controller = new AbortController()

    const fetchPaymentMethods = async () => {
      // Hanya aktifkan skeleton loader jika belum ada metode pembayaran yang dimuat sama sekali
      if (paymentMethods.length === 0) {
        setPaymentMethodsLoading(true)
      }
      setPaymentMethodsError('')

      try {
        const response = await fetch(
          `${API_BASE_URL}/payment-methods?product_id=${selectedProduct.ID}&quantity=${quantity}`,
          {
            cache: 'no-store',
            signal: controller.signal
          }
        )
        const result = (await response.json()) as PaymentMethodsResponse & {
          error?: string
          reason?: string
        }

        if (!response.ok) {
          throw new Error(
            result.reason ||
              result.error ||
              'Metode pembayaran belum bisa dimuat.'
          )
        }

        const safeMethods = Array.isArray(result.methods) ? result.methods : []
        const availableMethods = safeMethods.filter(method => method.enabled)

        // Update data kartu secara in-place tanpa menghapus elemen lama lebih dulu
        setPaymentMethods(safeMethods)

        // Pertahankan metode pembayaran yang sedang dipilih jika masih tersedia
        setSelectedQuoteKey(prevKey => {
          const isPrevStillValid = availableMethods.some(
            m => m.quote_key === prevKey
          )
          if (isPrevStillValid) return prevKey

          const recommendedMethod =
            availableMethods.find(m => m.recommended) || availableMethods[0]
          return recommendedMethod?.quote_key || ''
        })

        if (availableMethods.length === 0) {
          const minimumReason = result.minimum_transaction_amount
            ? `Minimum transaksi Rp${result.minimum_transaction_amount.toLocaleString(
                'id-ID'
              )}.`
            : 'Belum ada metode Midtrans yang aktif untuk nominal ini.'
          const reason =
            safeMethods.find(method => method.disabled_reason)
              ?.disabled_reason || minimumReason

          setPaymentMethodsError(reason)
        }
      } catch (error) {
        if (controller.signal.aborted) return

        setPaymentMethodsError(
          error instanceof Error
            ? error.message
            : 'Metode pembayaran belum bisa dimuat.'
        )
      } finally {
        if (!controller.signal.aborted) {
          setPaymentMethodsLoading(false)
        }
      }
    }

    fetchPaymentMethods()

    return () => controller.abort()
  }, [selectedProduct, quantity, paymentMethodsRefreshKey])

  const selectedTarget = zoneId ? `${userId} (${zoneId})` : userId
  const shortName =
    game?.short_name?.trim() ||
    game?.shortName?.trim() ||
    publicCatalog?.shortName ||
    game?.name[0] ||
    'AJ'
  const requiresZone = Boolean(
    game?.slug.toLowerCase().includes('mobile-legends')
  )
  const hasAccountData =
    userId.trim().length > 0 && (!requiresZone || zoneId.trim().length > 0)
  const currentStep = !hasAccountData ? 1 : selectedProduct ? 3 : 2

  useEffect(() => {
    if (!hasAccountData) {
      setSelectedProduct(null)
      return
    }

    setAccountWarning(false)
    setAccountAttention(false)
  }, [hasAccountData])

  const selectedPaymentMethod = paymentMethods.find(
    method => method.quote_key === selectedQuoteKey
  )
  const paymentMethodLabel = selectedPaymentMethod?.name || 'Belum dipilih'

  const unitPrice = selectedProduct
    ? selectedPaymentMethod?.base_price ??
      getProductStartingPrice(selectedProduct)
    : 0
  const productAmount = selectedProduct ? unitPrice * quantity : undefined
  const productAmountLabel = selectedProduct
    ? formatIDR(getProductStartingPrice(selectedProduct))
    : 'Belum dipilih'

  const customerSurcharge = selectedPaymentMethod?.customer_surcharge ?? 0
  const customerSurchargeLabel = selectedPaymentMethod
    ? formatIDR(customerSurcharge)
    : 'Belum tersedia'

  const totalAmount = selectedPaymentMethod
    ? selectedPaymentMethod.base_price * quantity + customerSurcharge
    : selectedProduct
    ? getProductStartingPrice(selectedProduct) * quantity
    : undefined

  const totalLabel =
    typeof totalAmount === 'number' ? formatIDR(totalAmount) : 'Belum tersedia'

  const appliedPromoCode = promoCode.trim() || undefined

  const canCheckout =
    PURCHASES_ENABLED &&
    Boolean(selectedProduct) &&
    Boolean(userId) &&
    (!requiresZone || Boolean(zoneId)) &&
    Boolean(selectedQuoteKey) &&
    Boolean(selectedPaymentMethod?.enabled) &&
    !paymentMethodsLoading &&
    !paymentMethodsError

  const disabledReason = !PURCHASES_ENABLED
    ? 'Katalog masih dapat dilihat dalam mode preview.'
    : !userId
    ? 'Masukkan User ID untuk melanjutkan.'
    : requiresZone && !zoneId
    ? 'Masukkan Zone ID untuk melanjutkan.'
    : !selectedProduct
    ? 'Pilih nominal untuk melanjutkan.'
    : paymentMethodsLoading
    ? 'Metode pembayaran sedang dimuat.'
    : paymentMethodsError
    ? paymentMethodsError
    : !selectedQuoteKey
    ? 'Pilih metode pembayaran untuk melanjutkan.'
    : ''

  const handleSelectProduct = (product: Product) => {
    if (!hasAccountData) {
      const missingInput =
        userId.trim().length === 0
          ? userIdRef.current
          : requiresZone && zoneId.trim().length === 0
          ? zoneIdRef.current
          : null

      setAccountWarning(true)
      setAccountAttention(true)

      if (focusTimerRef.current !== null) {
        window.clearTimeout(focusTimerRef.current)
      }

      if (attentionTimerRef.current !== null) {
        window.clearTimeout(attentionTimerRef.current)
      }

      window.requestAnimationFrame(() => {
        accountSectionRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        })
      })

      focusTimerRef.current = window.setTimeout(() => {
        missingInput?.focus({ preventScroll: true })
        focusTimerRef.current = null
      }, 500)

      attentionTimerRef.current = window.setTimeout(() => {
        setAccountAttention(false)
        attentionTimerRef.current = null
      }, 1800)

      return
    }

    setAccountWarning(false)
    setAccountAttention(false)

    if (selectedProduct?.ID !== product.ID) {
      setSelectedQuoteKey('')
      setPaymentMethods([])
      setPaymentMethodsError('')
      setSelectedProduct(product)
    }

    if (scrollTimerRef.current !== null) {
      window.clearTimeout(scrollTimerRef.current)
    }

    // Mengarahkan scroll & fokus ke modul 'Jumlah Pembelian'
    scrollTimerRef.current = window.setTimeout(() => {
      const quantitySection = quantitySectionRef.current

      quantitySection?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      })
      quantitySection?.focus({ preventScroll: true })
      scrollTimerRef.current = null
    }, 180)
  }

  const handleOpenConfirmModal = () => {
    if (!PURCHASES_ENABLED) return

    if (!userId || !selectedProduct || (requiresZone && !zoneId)) {
      alert(
        requiresZone && !zoneId
          ? 'Mohon lengkapi User ID, Zone ID, dan pilih nominal.'
          : 'Mohon lengkapi ID Player dan pilih nominal.'
      )
      return
    }

    if (!selectedQuoteKey || !selectedPaymentMethod) {
      alert('Mohon pilih metode pembayaran terlebih dahulu.')
      return
    }

    setShowConfirmModal(true)
  }

  const handleCheckout = async () => {
    if (!PURCHASES_ENABLED) return

    if (!userId || !selectedProduct || (requiresZone && !zoneId)) {
      alert(
        requiresZone && !zoneId
          ? 'Mohon lengkapi User ID, Zone ID, dan pilih nominal.'
          : 'Mohon lengkapi ID Player dan pilih nominal.'
      )
      return
    }

    setIsProcessing(true)
    setShowConfirmModal(false)

    try {
      await prepareMidtransSnap()

      const res = await fetch(`${API_BASE_URL}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: selectedProduct.ID,
          customer_phone: selectedTarget,
          quote_key: selectedQuoteKey,
          expected_total_amount:
            totalAmount || selectedPaymentMethod?.total_amount || 0,
          quantity: quantity,
          contact_info: contactInfo.trim() || undefined,
          promo_code: promoCode.trim() || undefined
        })
      })

      const result = await res.json()

      if (res.status === 409 && result.error_code === 'QUOTE_CHANGED') {
        setPaymentMethodsRefreshKey(current => current + 1)
        alert(
          result.reason ||
            'Harga atau biaya pembayaran berubah. Periksa total terbaru.'
        )
        return
      }

      if (res.ok) {
        const checkoutData = (result.data || result) as CheckoutData
        setTransactionData(checkoutData)

        if (checkoutData.snap_token) {
          // @ts-ignore
          window.snap.pay(checkoutData.snap_token, {
            onSuccess: () => {
              setShowModal(true)
            },
            onPending: () => {
              router.push('/cek-pesanan/')
            },
            onError: () => {
              setShowModal(true)
            },
            onClose: () => {
              router.push('/cek-pesanan/')
            }
          })
        } else {
          setShowModal(true)
        }
      } else {
        alert(
          'Gagal: ' +
            (result.reason || result.error || 'Checkout belum berhasil.')
        )
      }
    } catch (error) {
      alert(
        error instanceof Error ? error.message : 'Terjadi kesalahan sistem.'
      )
    } finally {
      setIsProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className='relative isolate min-h-screen overflow-x-clip bg-black text-white'>
        <Navbar />
        <main className='relative isolate min-h-screen overflow-hidden bg-black px-4 pb-16 pt-28 sm:px-6'>
          <div className='pointer-events-none absolute inset-x-0 top-0 -z-10 h-[820px] overflow-hidden'>
            <CyberneticGridShader />
            <div className='absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,transparent_0%,rgba(0,0,0,0.18)_48%,rgba(0,0,0,0.76)_100%)]' />
            <div className='absolute inset-x-0 bottom-0 h-[50%] bg-gradient-to-b from-transparent via-black/[0.78] to-black' />
          </div>

          <div className='mx-auto max-w-6xl'>
            <div className='h-[360px] animate-pulse rounded-[28px] border border-white/[0.06] bg-white/[0.035] [animation-duration:2.4s] sm:rounded-[32px]' />
            <div className='mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_370px]'>
              <div className='h-[520px] animate-pulse rounded-[24px] border border-white/[0.06] bg-white/[0.035] [animation-duration:2.4s]' />
              <div className='h-[380px] animate-pulse rounded-[24px] border border-white/[0.06] bg-white/[0.035] [animation-duration:2.4s]' />
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (!game) {
    return (
      <div className='relative isolate overflow-x-clip bg-black text-white'>
        <Navbar />
        <main className='relative z-10 flex min-h-screen items-center overflow-hidden rounded-b-[30px] bg-black px-4 py-32 sm:rounded-b-[38px] sm:px-6'>
          <div className='pointer-events-none absolute inset-x-0 top-0 -z-10 h-[760px] overflow-hidden'>
            <CyberneticGridShader />
            <div className='absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,transparent_0%,rgba(0,0,0,0.22)_48%,rgba(0,0,0,0.82)_100%)]' />
            <div className='absolute inset-x-0 bottom-0 h-[52%] bg-gradient-to-b from-transparent via-black/[0.8] to-black' />
          </div>

          <div className='mx-auto w-full max-w-xl rounded-[28px] border border-white/[0.08] bg-black/[0.035] p-7 text-center shadow-[0_22px_70px_rgba(0,0,0,0.22)] backdrop-blur-md backdrop-saturate-150 sm:p-10'>
            <p className='font-mono text-[10px] uppercase tracking-[0.12em] text-white/[0.42]'>
              Katalog tidak ditemukan
            </p>
            <h1 className='mt-4 text-[36px] font-medium leading-tight tracking-[-0.04em] text-white sm:text-[46px]'>
              Game belum tersedia
            </h1>
            <p className='mt-5 text-sm leading-7 text-white/[0.52] sm:text-base'>
              {loadError ||
                'Katalog yang kamu buka belum tersedia di Anggijajan.'}
            </p>
            <button
              type='button'
              onClick={() => router.push('/#game')}
              className='mt-8 min-h-12 rounded-full border border-white bg-white px-7 text-sm font-semibold text-black transition-[border-color,background-color,box-shadow] duration-300 hover:border-fuchsia-300 hover:bg-fuchsia-300 hover:shadow-[0_12px_34px_rgba(217,70,239,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/70'
            >
              Kembali ke katalog
            </button>
          </div>
        </main>
        <SiteFooter />
      </div>
    )
  }

  return (
    <div className='relative isolate w-full overflow-x-clip bg-black text-white'>
      <Navbar />

      <main className='relative z-10 isolate min-h-screen overflow-x-clip bg-black pb-16 pt-16 sm:pb-20'>
        <div className='pointer-events-none absolute inset-x-0 top-0 -z-20 h-[920px] overflow-hidden'>
          <CyberneticGridShader />
          <div className='absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,transparent_0%,rgba(0,0,0,0.18)_48%,rgba(0,0,0,0.72)_100%)]' />
          <div className='absolute inset-x-0 bottom-0 h-[48%] bg-gradient-to-b from-transparent via-black/[0.74] to-black' />
        </div>

        <div className='pointer-events-none absolute inset-x-0 top-[620px] bottom-0 -z-10 overflow-hidden'>
          <div className='absolute -left-56 top-16 h-[440px] w-[440px] rounded-full bg-[radial-gradient(circle,rgba(168,85,247,0.12)_0%,rgba(168,85,247,0.035)_44%,transparent_72%)] blur-[96px]' />
          <div className='absolute right-[4%] top-[460px] h-[380px] w-[82vw] max-w-[520px] rounded-[50%] bg-[radial-gradient(ellipse,rgba(59,130,246,0.075)_0%,rgba(59,130,246,0.018)_48%,transparent_76%)] blur-[112px]' />
        </div>

        <div className='relative mx-auto max-w-6xl px-4 sm:px-6'>
          <GamePurchaseHero
            category={game.category}
            publisher={game.publisher}
            region={game.region}
            description={
              game.description ||
              publicCatalog?.description ||
              'Top up game digital Anggijajan.'
            }
            imageUrl={game.image_url}
            bannerUrl={game.banner_url}
            characterVideoUrl={
              game.slug === 'mobile-legends'
                ? '/videos/catalogs/mobile-legends-lilya-seamless.webm'
                : undefined
            }
            name={game.name}
            shortName={shortName}
          />

          <div className='-mt-[72px] grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_370px]'>
            <div className='space-y-6'>
              {!PURCHASES_ENABLED && (
                <section
                  aria-label='Status pembelian'
                  className='rounded-[22px] border border-white/[0.08] bg-black/[0.035] p-5 shadow-[0_22px_70px_rgba(0,0,0,0.22)] backdrop-blur-md backdrop-saturate-150 sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-6'
                >
                  <div>
                    <p className='text-base font-medium text-white'>
                      Pembelian online sedang ditutup sementara.
                    </p>
                    <p className='mt-2 text-sm leading-6 text-white/[0.48]'>
                      Katalog tetap dapat dilihat. Checkout akan aktif setelah
                      layanan resmi dibuka.
                    </p>
                  </div>
                  <span className='mt-4 inline-flex shrink-0 rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-white/[0.52] sm:mt-0'>
                    Preview catalog
                  </span>
                </section>
              )}

              <div className='lg:sticky lg:top-[104px] lg:z-30'>
                <CheckoutStepper currentStep={currentStep} />
              </div>

              <div ref={accountSectionRef}>
                <AccountTargetFields
                  requiresZone={requiresZone}
                  userId={userId}
                  zoneId={zoneId}
                  userIdRef={userIdRef}
                  zoneIdRef={zoneIdRef}
                  showWarning={accountWarning}
                  attention={accountAttention}
                  onUserIdChange={setUserId}
                  onZoneIdChange={setZoneId}
                />
              </div>

              <ProductSelector
                sections={game.productSections}
                selectedProduct={selectedProduct}
                isAccountComplete={hasAccountData}
                accountWarning={accountWarning}
                requiresZone={requiresZone}
                formatPrice={formatIDR}
                onSelect={handleSelectProduct}
              />

              <div
                ref={quantitySectionRef}
                tabIndex={-1}
                className='scroll-mt-[168px] outline-none lg:scroll-mt-[252px]'
              >
                <QuantitySelector
                  quantity={quantity}
                  onChange={setQuantity}
                  disabled={!selectedProduct || !hasAccountData}
                />
              </div>

              <div
                ref={paymentSectionRef}
                tabIndex={-1}
                className='scroll-mt-[168px] outline-none lg:scroll-mt-[252px]'
              >
                <PaymentMethodSelector
                  hasSelectedProduct={Boolean(selectedProduct)}
                  loading={paymentMethodsLoading}
                  error={paymentMethodsError}
                  methods={paymentMethods}
                  selectedQuoteKey={selectedQuoteKey}
                  onSelect={setSelectedQuoteKey}
                />
              </div>

              <ContactInfo
                value={contactInfo}
                onChange={setContactInfo}
                disabled={!selectedProduct || !hasAccountData}
              />

              <PromoCodeInput
                value={promoCode}
                onChange={setPromoCode}
                disabled={!selectedProduct || !hasAccountData}
              />

              {/* OrderSummary Mobile */}
              <div className='lg:hidden'>
                <OrderSummary
                  canCheckout={canCheckout}
                  disabledReason={disabledReason}
                  isProcessing={isProcessing}
                  purchasesEnabled={PURCHASES_ENABLED}
                  rows={[
                    ['Game', game.name],
                    ['Produk', selectedProduct ? selectedProduct.name : '-'], // Tanpa tambahan (5x) di sini
                    [
                      'Target',
                      `${selectedTarget}${zoneId ? ` (${zoneId})` : ''}`
                    ]
                  ]}
                  productAmountLabel={productAmountLabel}
                  quantity={quantity}
                  paymentMethodLabel={paymentMethodLabel}
                  customerSurchargeLabel={customerSurchargeLabel}
                  hasCustomerSurcharge={customerSurcharge > 0}
                  appliedPromoCode={appliedPromoCode}
                  totalLabel={totalLabel}
                  onCheckout={handleOpenConfirmModal}
                />
              </div>
            </div>

            {/* OrderSummary Desktop */}
            <aside className='relative hidden lg:block lg:self-stretch'>
              <div className='custom-scrollbar lg:sticky lg:top-[104px] lg:max-h-[calc(100svh-120px)] lg:overflow-y-auto lg:overscroll-contain'>
                <OrderSummary
                  canCheckout={canCheckout}
                  disabledReason={disabledReason}
                  isProcessing={isProcessing}
                  purchasesEnabled={PURCHASES_ENABLED}
                  rows={[
                    ['Game', game.name],
                    ['Produk', selectedProduct ? selectedProduct.name : '-'], // Tanpa tambahan (5x) di sini
                    [
                      'Target',
                      `${selectedTarget}${zoneId ? ` (${zoneId})` : ''}`
                    ]
                  ]}
                  productAmountLabel={productAmountLabel}
                  quantity={quantity}
                  paymentMethodLabel={paymentMethodLabel}
                  customerSurchargeLabel={customerSurchargeLabel}
                  hasCustomerSurcharge={customerSurcharge > 0}
                  appliedPromoCode={appliedPromoCode}
                  totalLabel={totalLabel}
                  onCheckout={handleOpenConfirmModal}
                />
              </div>
            </aside>
          </div>
        </div>
      </main>

      <SiteFooter />

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleCheckout}
        isProcessing={isProcessing}
        data={{
          userId,
          zoneId,
          gameName: game.name,
          productName: selectedProduct
            ? quantity > 1
              ? `${selectedProduct.name} (${quantity}x)`
              : selectedProduct.name
            : '-',
          paymentMethodName: paymentMethodLabel,
          paymentMethodImage: selectedPaymentMethod?.image_url,
          paymentMethodCode: selectedPaymentMethod?.code,
          isQris: selectedPaymentMethod?.category === 'QRIS',
          productAmountLabel,
          surchargeLabel: customerSurchargeLabel,
          hasCustomerSurcharge: customerSurcharge > 0,
          totalLabel
        }}
      />

      {/* Payment Modal / Midtrans Status */}
      <PaymentModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        data={transactionData}
      />
    </div>
  )
}
