'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Image from 'next/image'
import Lottie from 'lottie-react'
import { motion } from 'framer-motion'
import { useApi } from '@/hooks/useApi' // 🔥 1. IMPORT SATPAM
import errorAnim from '../../../../public/animations/error.json'
import successAnim from '../../../../public/animations/success.json'

// ==========================================
// TIPE DATA & CONFIG
// ==========================================

interface Product {
  ID: number
  code: string
  name: string
  price: number
  is_active: boolean
  stock?: number
  catalog?: {
    name: string
    cardcode?: string
    slug?: string
    check_id_code?: string
  }
}

type InputType = 'NUMERIC' | 'TEXT' | 'ZONE' | 'SERVER'

interface GameConfig {
  type: InputType
  label1: string
  placeholder1: string
  label2?: string
  servers?: { name: string; id: string }[]
  info?: string
}

interface FeedLog {
  invoice: string
  item: string
  target: string
  status: 'INFO' | 'SUCCESS' | 'FAILED'
  desc: string
}

type ManualOrderStep =
  | 'SELECT_PRODUCT'
  | 'CONFIGURE_ORDER'
  | 'QRIS_PAYMENT'
  | 'FULFILLMENT_RESULT'

type NoticeType = 'success' | 'error' | 'info'
type SalesOpsTab = 'ORDER' | 'QUEUE'
type AccountCheckStatus =
  | 'IDLE'
  | 'CHECKING'
  | 'VALID'
  | 'INVALID'
  | 'UNAVAILABLE'
  | 'MANUAL'
type PaymentModalMode =
  | 'QRIS_MODE'
  | 'READY_MODE'
  | 'PROCESSING_MODE'
  | 'RESULT_MODE'
  | 'EXPIRED_MODE'

interface ManualOrderTransaction {
  ID: number
  CreatedAt?: string
  UpdatedAt?: string
  invoice_id: string
  customer_phone?: string
  amount?: number
  capital?: number
  profit?: number
  status?: string
  payment_status?: string
  fulfillment_status?: string
  provider_status?: string

  payment_method?: string
  payment_url?: string
  reference?: string
  provider_ref?: string

  serial_number?: string
  sn?: string
  error_message?: string
  manual_order_type?: string

  Product?: Product
  product?: Product
}

const MANUAL_ORDER_TYPES = [
  'Harga Khusus',
  'WhatsApp Customer',
  'Replace Transaksi Gagal',
  'Other'
]

const SALES_ORDER_STEPS: { key: ManualOrderStep; label: string }[] = [
  { key: 'SELECT_PRODUCT', label: 'Product' },
  { key: 'CONFIGURE_ORDER', label: 'Order' },
  { key: 'QRIS_PAYMENT', label: 'QRIS' },
  { key: 'FULFILLMENT_RESULT', label: 'Fulfillment' }
]

const GAME_SCHEMAS: Record<string, GameConfig> = {
  'MOBILE LEGENDS': {
    type: 'ZONE',
    label1: 'User ID',
    placeholder1: '12345678',
    label2: 'Zone ID',
    info: ''
  },
  'RAGNAROK M': {
    type: 'ZONE',
    label1: 'Character ID',
    placeholder1: '123456',
    label2: 'Zone ID'
  },
  'POINT BLANK': {
    type: 'ZONE',
    label1: 'User ID',
    placeholder1: 'Garena ID',
    label2: 'Server ID'
  },
  'GENSHIN IMPACT': {
    type: 'SERVER',
    label1: 'UID',
    placeholder1: '800...',
    servers: [
      { name: 'Asia', id: '001' },
      { name: 'America', id: '002' },
      { name: 'Europe', id: '003' },
      { name: 'TW/HK/MO', id: '004' }
    ]
  },
  'HONKAI: STAR RAIL': {
    type: 'SERVER',
    label1: 'UID',
    placeholder1: '800...',
    servers: [
      { name: 'Asia', id: 'prod_official_asia' },
      { name: 'America', id: 'prod_official_usa' },
      { name: 'Europe', id: 'prod_official_eur' }
    ]
  },
  VALORANT: {
    type: 'TEXT',
    label1: 'Riot ID',
    placeholder1: 'Username#Tag123',
    info: 'Wajib format Nama#Tag'
  },
  'LEAGUE OF LEGENDS': {
    type: 'TEXT',
    label1: 'Riot ID',
    placeholder1: 'Username#Tag'
  },
  GROWTOPIA: {
    type: 'TEXT',
    label1: 'GrowID',
    placeholder1: 'Masukan GrowID',
    info: 'Pastikan GrowID & World benar'
  },
  DEFAULT: {
    type: 'NUMERIC',
    label1: 'User ID',
    placeholder1: 'Contoh: 12345678'
  }
}

// ✨ PREMIUM GLASSMORPHISM COMPONENT ✨
const GlassCard = ({
  children,
  className = ''
}: {
  children: React.ReactNode
  className?: string
}) => (
  <div
    className={`relative overflow-hidden bg-gradient-to-br from-white/[0] to-transparent backdrop-blur-[100px] backdrop-saturate-[200%] border border-white/[0.04] shadow-[0_8px_32px_0_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(255,255,255,0.02)] rounded-[28px] ${className}`}
  >
    <div className='absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.15] to-transparent opacity-40' />
    <div className='relative z-10'>{children}</div>
  </div>
)

export default function ManualOrderPage () {
  // 🔥 2. PANGGIL METHOD GET & POST DARI USEAPI
  const { get, post } = useApi()
  const [isQrisModalOpen, setIsQrisModalOpen] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [loadingData, setLoadingData] = useState(true)

  // Selection
  const [selectedCatalog, setSelectedCatalog] = useState<string>('')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  // Input State
  const [input1, setInput1] = useState('')
  const [input2, setInput2] = useState('')
  const [sellingPriceInput, setSellingPriceInput] = useState('')
  const [injectReason, setInjectReason] = useState('')
  const [orderType, setOrderType] = useState(MANUAL_ORDER_TYPES[0])
  const [manualOrder, setManualOrder] = useState<ManualOrderTransaction | null>(
    null
  )
  const [qrisOrder, setQrisOrder] = useState<ManualOrderTransaction | null>(
    null
  )

  const [runningOrders, setRunningOrders] = useState<ManualOrderTransaction[]>(
    []
  )
  const [isRunningModalOpen, setIsRunningModalOpen] = useState(false)
  const [loadingRunningOrders, setLoadingRunningOrders] = useState(false)
  const [activeOpsTab, setActiveOpsTab] = useState<SalesOpsTab>('ORDER')

  const [flowStep, setFlowStep] = useState<ManualOrderStep>('SELECT_PRODUCT')
  const [isCreatingOrder, setIsCreatingOrder] = useState(false)
  const [executingOrderIDs, setExecutingOrderIDs] = useState<number[]>([])
  const [isCheckingProviderStatus, setIsCheckingProviderStatus] =
    useState(false)
  const [actionNotice, setActionNotice] = useState<{
    type: NoticeType
    message: string
  } | null>(null)

  // Automatic account validation
  const [nickname, setNickname] = useState<string | null>(null)
  const [accountCheckStatus, setAccountCheckStatus] =
    useState<AccountCheckStatus>('IDLE')
  const [accountCheckMessage, setAccountCheckMessage] = useState('')
  const [accountCheckRetryKey, setAccountCheckRetryKey] = useState(0)

  // Logs
  const [feedLogs, setFeedLogs] = useState<FeedLog[]>([])

  // Search & Sort State
  const [searchTerm, setSearchTerm] = useState('')
  const [filterMode, setFilterMode] = useState('price_asc')

  // 1. Load Logs
  useEffect(() => {
    const savedLogs = localStorage.getItem('manualInjectorLogs')
    if (savedLogs) {
      try {
        setFeedLogs(JSON.parse(savedLogs))
      } catch (e) {
        console.error('Gagal load history log', e)
      }
    }
  }, [])

  // 2. Save Logs
  useEffect(() => {
    if (feedLogs.length > 0) {
      localStorage.setItem('manualInjectorLogs', JSON.stringify(feedLogs))
    }
  }, [feedLogs])

  // 🔥 3. FETCH PRODUCTS BERSIH PAKAI GET()
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await get('/products')
        const data = await res.json()
        if (data.products) {
          setProducts(data.products)
          if (data.products.length > 0 && data.products[0].catalog?.name) {
            setSelectedCatalog(data.products[0].catalog.name)
          }
        }
      } catch (error) {
        console.error('Error', error)
      } finally {
        setLoadingData(false)
      }
    }
    fetchProducts()
  }, [get])

  // Memos
  const catalogs = useMemo(() => {
    const list = new Set(products.map(p => p.catalog?.name).filter(Boolean))
    return Array.from(list) as string[]
  }, [products])

  const filteredProducts = useMemo(() => {
    let filtered = products.filter(p => {
      const checkerCode = p.catalog?.check_id_code?.trim().toUpperCase()

      const productCode = p.code.trim().toUpperCase()

      const isCheckerProduct = !!checkerCode && productCode === checkerCode

      return p.catalog?.name === selectedCatalog && !isCheckerProduct
    })

    // 1. Filter Pencarian
    if (searchTerm) {
      filtered = filtered.filter(
        p =>
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.code.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Helper fungsi biar gampang nentuin status "Gangguan" (Sesuai logic lu)
    const isUnavailable = (p: Product) =>
      !p.is_active || (p.stock !== undefined && p.stock <= 0 && p.stock !== -1)

    // 2. Filter Kategori & Sorting Harga
    if (filterMode === 'active_only') {
      filtered = filtered.filter(p => !isUnavailable(p)) // Cuma yang aman
    } else if (filterMode === 'inactive_only') {
      filtered = filtered.filter(p => isUnavailable(p)) // Cuma yang gangguan
    } else if (filterMode === 'price_asc') {
      filtered = [...filtered].sort((a, b) => a.price - b.price) // Termurah
    } else if (filterMode === 'price_desc') {
      filtered = [...filtered].sort((a, b) => b.price - a.price) // Termahal
    }

    return filtered
  }, [products, selectedCatalog, searchTerm, filterMode])

  const currentSchema = useMemo(() => {
    if (!selectedCatalog) return GAME_SCHEMAS['DEFAULT']
    const upperName = selectedCatalog.toUpperCase()
    const foundKey = Object.keys(GAME_SCHEMAS).find(key =>
      upperName.includes(key)
    )
    return foundKey ? GAME_SCHEMAS[foundKey] : GAME_SCHEMAS['DEFAULT']
  }, [selectedCatalog])

  const activeCatalogInfo = useMemo(() => {
    const sample = products.find(p => p.catalog?.name === selectedCatalog)
    return sample?.catalog
  }, [selectedCatalog, products])

  const supportsAccountCheck = Boolean(
    activeCatalogInfo?.check_id_code && activeCatalogInfo?.slug
  )
  const requiresSecondTargetField =
    currentSchema.type === 'ZONE' || currentSchema.type === 'SERVER'
  const isTargetComplete =
    !!input1.trim() && (!requiresSecondTargetField || !!input2.trim())

  // Reset inputs saat ganti katalog
  useEffect(() => {
    setInput1('')
    setInput2('')
    setNickname(null)
    setAccountCheckStatus('IDLE')
    setAccountCheckMessage('')
    setSelectedProduct(null)
    setSellingPriceInput('')
    setInjectReason('')
    setOrderType(MANUAL_ORDER_TYPES[0])
    setManualOrder(null)
    setQrisOrder(null)
    setFlowStep('SELECT_PRODUCT')
    setActionNotice(null)
    setIsQrisModalOpen(false)
  }, [selectedCatalog])

  // Reset inputs saat ganti produk
  useEffect(() => {
    if (manualOrder) return

    setNickname(null)
    setAccountCheckStatus('IDLE')
    setAccountCheckMessage('')

    if (selectedProduct) {
      setSellingPriceInput(String(Math.round(selectedProduct.price)))
      setFlowStep('CONFIGURE_ORDER')
      setManualOrder(null)
      setQrisOrder(null)
      setActionNotice(null)
      setIsQrisModalOpen(false)
    } else {
      setSellingPriceInput('')
      setFlowStep('SELECT_PRODUCT')
      setQrisOrder(null)
      setIsQrisModalOpen(false)
    }
  }, [selectedProduct, manualOrder])

  // Check account automatically after the admin stops typing.
  useEffect(() => {
    let cancelled = false

    setNickname(null)
    setAccountCheckMessage('')

    if (!selectedProduct || !supportsAccountCheck || !isTargetComplete) {
      setAccountCheckStatus('IDLE')
      return
    }

    setAccountCheckStatus('IDLE')

    const timeoutID = window.setTimeout(async () => {
      setAccountCheckStatus('CHECKING')

      try {
        const res = await post('/check-account', {
          slug: activeCatalogInfo?.slug,
          user_id: input1.trim(),
          zone_id: input2.trim()
        })
        const data = await res.json()

        if (cancelled) return

        if (!res.ok) {
          throw new Error(
            data.error || data.message || 'Checker akun tidak tersedia'
          )
        }

        if (data.valid) {
          setNickname(data.nickname || 'Nickname ditemukan')
          setAccountCheckStatus('VALID')
          setAccountCheckMessage(data.message || 'Akun berhasil diverifikasi')
          return
        }

        setAccountCheckStatus('INVALID')
        setAccountCheckMessage(data.message || 'ID akun tidak ditemukan')
      } catch (error) {
        if (cancelled) return

        setAccountCheckStatus('UNAVAILABLE')
        setAccountCheckMessage(
          error instanceof Error
            ? error.message
            : 'Checker akun sedang tidak tersedia'
        )
      }
    }, 600)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutID)
    }
  }, [
    accountCheckRetryKey,
    activeCatalogInfo?.slug,
    input1,
    input2,
    isTargetComplete,
    post,
    selectedProduct,
    supportsAccountCheck
  ])

  const retryAccountCheck = () => {
    setAccountCheckRetryKey(value => value + 1)
  }

  const continueWithoutAccountCheck = () => {
    setNickname(null)
    setAccountCheckStatus('MANUAL')
    setAccountCheckMessage(
      'Checker dilewati. Pastikan target sudah benar sebelum membuat order.'
    )
  }

  const getFinalTargetID = () => {
    if (currentSchema.type === 'ZONE') return input1 + input2
    if (currentSchema.type === 'SERVER') return input1 + input2
    return input1
  }

  const formatIDR = (value: number) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(value)

  const parseIDRInput = (value: string) => {
    const numeric = value.replace(/[^\d]/g, '')
    return Number(numeric || 0)
  }

  const modalProvider = selectedProduct?.price || 0
  const webPrice = Math.round(modalProvider * 1.05)
  const sellingPrice = parseIDRInput(sellingPriceInput)
  const profit = sellingPrice - modalProvider
  const tripayMaxAmount = 5000000

  const isPriceBelowModal = !!selectedProduct && sellingPrice < modalProvider
  const isPriceAboveWeb = !!selectedProduct && sellingPrice > webPrice
  const isPriceAboveTripayMax =
    !!selectedProduct && sellingPrice > tripayMaxAmount
  const isPriceValid =
    !!selectedProduct &&
    sellingPrice > 0 &&
    sellingPrice >= modalProvider &&
    sellingPrice <= webPrice &&
    sellingPrice <= tripayMaxAmount

  const priceError = isPriceBelowModal
    ? `Harga jual tidak boleh di bawah modal (${formatIDR(modalProvider)})`
    : isPriceAboveWeb
    ? `Harga jual tidak boleh lebih dari harga web (${formatIDR(webPrice)})`
    : isPriceAboveTripayMax
    ? `Nominal QRIS Tripay maksimal ${formatIDR(tripayMaxAmount)}`
    : ''

  const handleSellingPriceChange = (value: string) => {
    setSellingPriceInput(value.replace(/[^\d]/g, ''))
  }

  const applyMarkup = (percent: number) => {
    if (!selectedProduct) return

    const nextPrice = Math.round(modalProvider * (1 + percent / 100))
    const cappedPrice = Math.min(nextPrice, webPrice)

    setSellingPriceInput(String(cappedPrice))
  }

  const requiresOrderNote = orderType === 'Other'
  const orderNote = requiresOrderNote ? injectReason.trim() : orderType
  const activePaymentOrder = qrisOrder || manualOrder
  const activePaymentOrderID = activePaymentOrder?.ID

  const getOrderPaymentStatus = useCallback(
    (order?: ManualOrderTransaction | null): string => {
      if (!order) return ''

      const fallbackStatus =
        order.status === 'PAID' ||
        order.status === 'EXPIRED' ||
        order.status === 'FAILED'
          ? order.status
          : 'UNPAID'

      return (order.payment_status || fallbackStatus).toUpperCase()
    },
    []
  )

  const getOrderFulfillmentStatus = useCallback(
    (order?: ManualOrderTransaction | null): string => {
      if (!order) return ''
      return (order.fulfillment_status || 'WAITING_PAYMENT').toUpperCase()
    },
    []
  )

  const paymentStatus = getOrderPaymentStatus(activePaymentOrder)
  const fulfillmentStatus = getOrderFulfillmentStatus(activePaymentOrder)
  const isAccountCheckSatisfied =
    !supportsAccountCheck ||
    accountCheckStatus === 'VALID' ||
    accountCheckStatus === 'MANUAL'
  const canCreateOrder =
    !isCreatingOrder &&
    !!selectedProduct &&
    !!input1 &&
    isPriceValid &&
    !!orderType &&
    isAccountCheckSatisfied &&
    (!requiresOrderNote || !!injectReason.trim()) &&
    !(currentSchema.type === 'ZONE' && !input2) &&
    !(currentSchema.type === 'SERVER' && !input2)
  const hasProviderResult =
    !!activePaymentOrder &&
    (fulfillmentStatus === 'SUCCESS' || fulfillmentStatus === 'FAILED')
  const paymentModalMode: PaymentModalMode = hasProviderResult
    ? 'RESULT_MODE'
    : (paymentStatus === 'EXPIRED' || paymentStatus === 'FAILED') &&
      !hasProviderResult
    ? 'EXPIRED_MODE'
    : paymentStatus === 'PAID' && fulfillmentStatus === 'READY'
    ? 'READY_MODE'
    : paymentStatus === 'PAID'
    ? 'PROCESSING_MODE'
    : 'QRIS_MODE'
  const shouldShowQrisContent = paymentModalMode === 'QRIS_MODE'
  const isReadyMode = paymentModalMode === 'READY_MODE'
  const isProcessingMode = paymentModalMode === 'PROCESSING_MODE'
  const isResultMode = paymentModalMode === 'RESULT_MODE'
  const isExpiredMode = paymentModalMode === 'EXPIRED_MODE'
  const isPaymentFailedMode = isExpiredMode && paymentStatus === 'FAILED'
  const modalWidthClass = 'max-w-md'
  const modalModeLabel = isResultMode
    ? fulfillmentStatus === 'SUCCESS'
      ? 'Success'
      : 'Failed'
    : isExpiredMode
    ? isPaymentFailedMode
      ? 'Payment Failed'
      : 'Expired'
    : isReadyMode
    ? 'Ready'
    : isProcessingMode
    ? 'Processing'
    : 'QRIS Payment'
  const modalModeClass = isResultMode
    ? fulfillmentStatus === 'SUCCESS'
      ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200'
      : 'border-red-400/20 bg-red-500/10 text-red-200'
    : isExpiredMode
    ? isPaymentFailedMode
      ? 'border-red-400/20 bg-red-500/10 text-red-200'
      : 'border-yellow-400/20 bg-yellow-500/10 text-yellow-200'
    : isReadyMode
    ? 'border-[#e491c9]/25 bg-[#e491c9]/10 text-[#f1b7dc]'
    : 'border-sky-400/20 bg-sky-500/10 text-sky-200'
  const shouldShowModalNotice =
    !!actionNotice &&
    !isExpiredMode &&
    (shouldShowQrisContent ||
      isReadyMode ||
      isProcessingMode ||
      actionNotice.message.toLowerCase().includes('dicopy'))

  const getStatusChipClass = (status: string) => {
    switch (status.toUpperCase()) {
      case 'SUCCESS':
      case 'PAID':
        return 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200'
      case 'FAILED':
        return 'border-red-400/20 bg-red-500/10 text-red-200'
      case 'PROCESSING':
        return 'border-sky-400/20 bg-sky-500/10 text-sky-200'
      case 'READY':
        return 'border-[#e491c9]/25 bg-[#e491c9]/10 text-[#f1b7dc]'
      case 'EXPIRED':
      case 'UNPAID':
        return 'border-yellow-400/20 bg-yellow-500/10 text-yellow-200'
      default:
        return 'border-white/[0.08] bg-white/[0.03] text-slate-300'
    }
  }

  const queueSummary = useMemo(() => {
    let unpaid = 0
    let ready = 0
    let processing = 0

    runningOrders.forEach(order => {
      const orderPaymentStatus = getOrderPaymentStatus(order)
      const orderFulfillmentStatus = getOrderFulfillmentStatus(order)

      if (
        orderPaymentStatus === 'UNPAID' &&
        orderFulfillmentStatus === 'WAITING_PAYMENT'
      ) {
        unpaid += 1
      }
      if (orderFulfillmentStatus === 'READY') ready += 1
      if (orderFulfillmentStatus === 'PROCESSING') processing += 1
    })

    return {
      total: runningOrders.length,
      unpaid,
      ready,
      processing
    }
  }, [getOrderFulfillmentStatus, getOrderPaymentStatus, runningOrders])

  const queuePreview = runningOrders.slice(0, 2)
  const isRunningQueueOrder = useCallback(
    (order: ManualOrderTransaction) => {
      const orderPaymentStatus = getOrderPaymentStatus(order)
      const orderFulfillmentStatus = getOrderFulfillmentStatus(order)

      return (
        (orderPaymentStatus === 'UNPAID' &&
          orderFulfillmentStatus === 'WAITING_PAYMENT') ||
        (orderPaymentStatus === 'PAID' &&
          (orderFulfillmentStatus === 'READY' ||
            orderFulfillmentStatus === 'PROCESSING'))
      )
    },
    [getOrderFulfillmentStatus, getOrderPaymentStatus]
  )

  const getQueuePrimaryActionLabel = useCallback(
    (order: ManualOrderTransaction) => {
      const orderPaymentStatus = getOrderPaymentStatus(order)
      const orderFulfillmentStatus = getOrderFulfillmentStatus(order)

      if (
        orderPaymentStatus === 'UNPAID' &&
        orderFulfillmentStatus === 'WAITING_PAYMENT'
      ) {
        return 'Open Payment'
      }

      if (orderPaymentStatus === 'PAID' && orderFulfillmentStatus === 'READY') {
        return 'View & Execute'
      }

      return 'View Status'
    },
    [getOrderFulfillmentStatus, getOrderPaymentStatus]
  )

  const resetOrderForm = () => {
    setInput1('')
    setInput2('')
    setSelectedProduct(null)
    setNickname(null)
    setAccountCheckStatus('IDLE')
    setAccountCheckMessage('')
    setSellingPriceInput('')
    setInjectReason('')
    setOrderType(MANUAL_ORDER_TYPES[0])
    setManualOrder(null)
    setQrisOrder(null)
    setFlowStep('SELECT_PRODUCT')
    setActionNotice(null)
    setIsQrisModalOpen(false)
  }

  const getOrderProduct = (order?: ManualOrderTransaction | null) =>
    order?.Product || order?.product || null

  const formatDateTime = (value?: string) => {
    if (!value) return '-'

    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(value))
  }

  const fetchRunningOrders = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoadingRunningOrders(true)
      }

      try {
        const res = await get('/admin/manual-orders/running')
        const data = await res.json()

        if (!res.ok) {
          throw new Error(
            data.error || data.message || 'Gagal mengambil transaksi berjalan'
          )
        }

        const orders = Array.isArray(data.data)
          ? (data.data as ManualOrderTransaction[])
          : []

        setRunningOrders(orders.filter(isRunningQueueOrder))
      } catch (error) {
        console.error('Gagal load transaksi berjalan:', error)
      } finally {
        if (!silent) {
          setLoadingRunningOrders(false)
        }
      }
    },
    [get, isRunningQueueOrder]
  )

  const syncOrderState = useCallback(
    (updatedOrder: ManualOrderTransaction) => {
      setManualOrder(prev =>
        prev?.ID === updatedOrder.ID ? updatedOrder : prev
      )
      setQrisOrder(prev => (prev?.ID === updatedOrder.ID ? updatedOrder : prev))
      setRunningOrders(prev => {
        if (!isRunningQueueOrder(updatedOrder)) {
          return prev.filter(order => order.ID !== updatedOrder.ID)
        }

        return prev.map(order =>
          order.ID === updatedOrder.ID ? updatedOrder : order
        )
      })
    },
    [isRunningQueueOrder]
  )

  const refreshActiveOrderStatus = useCallback(async () => {
    if (!activePaymentOrderID) return null

    try {
      const res = await get(
        `/admin/manual-order/${activePaymentOrderID}/status`
      )
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || data.message || 'Gagal refresh order')
      }

      const updatedOrder = (data.data || data) as ManualOrderTransaction
      if (!updatedOrder?.ID) return null

      syncOrderState(updatedOrder)

      const updatedFulfillmentStatus = getOrderFulfillmentStatus(updatedOrder)
      const isFinalResult =
        updatedFulfillmentStatus === 'SUCCESS' ||
        updatedFulfillmentStatus === 'FAILED'

      if (isFinalResult) {
        const orderProduct = updatedOrder.Product || updatedOrder.product
        const isFailedResult = updatedFulfillmentStatus === 'FAILED'

        setFlowStep('FULFILLMENT_RESULT')
        setActionNotice(null)
        setFeedLogs(prev => {
          const nextLog: FeedLog = {
            invoice:
              updatedOrder.invoice_id ||
              `INV-${Date.now().toString().slice(-6)}`,
            item: orderProduct?.name || 'Produk Manual',
            target: updatedOrder.customer_phone || '-',
            status: isFailedResult ? 'FAILED' : 'SUCCESS',
            desc:
              updatedOrder.serial_number ||
              updatedOrder.sn ||
              updatedOrder.error_message ||
              updatedOrder.provider_status ||
              '-'
          }

          if (
            prev[0]?.invoice === nextLog.invoice &&
            prev[0]?.status === nextLog.status
          ) {
            return prev
          }

          return [nextLog, ...prev].slice(0, 3)
        })
        await fetchRunningOrders()
      }

      return updatedOrder
    } catch (error) {
      console.error('Gagal refresh status manual order:', error)
      return null
    }
  }, [
    activePaymentOrderID,
    fetchRunningOrders,
    get,
    getOrderFulfillmentStatus,
    syncOrderState
  ])

  const openRunningOrder = (order: ManualOrderTransaction) => {
    setQrisOrder(order)
    setActionNotice(null)
    setIsRunningModalOpen(false)
    setIsQrisModalOpen(true)
  }

  const closeQrisModal = () => {
    // Modal yang dibuka dari queue:
    // cukup tutup modal, jangan hapus draft form yang sedang dikerjakan.
    if (qrisOrder) {
      setIsQrisModalOpen(false)
      setQrisOrder(null)
      return
    }

    // Order yang baru dibuat dari form:
    // setelah modal ditutup, composer langsung kembali siap membuat order baru.
    resetOrderForm()
  }

  const handleModalNewOrder = () => {
    setIsRunningModalOpen(false)
    resetOrderForm()
  }

  useEffect(() => {
    fetchRunningOrders()
  }, [fetchRunningOrders])

  useEffect(() => {
    if (activeOpsTab !== 'QUEUE' && !isRunningModalOpen) {
      return
    }

    const refreshQueueSilently = () => {
      if (document.visibilityState === 'visible') {
        void fetchRunningOrders(true)
      }
    }

    refreshQueueSilently()
    const intervalID = window.setInterval(refreshQueueSilently, 8000)
    window.addEventListener('focus', refreshQueueSilently)

    return () => {
      window.clearInterval(intervalID)
      window.removeEventListener('focus', refreshQueueSilently)
    }
  }, [activeOpsTab, fetchRunningOrders, isRunningModalOpen])

  useEffect(() => {
    if (
      !isQrisModalOpen ||
      !activePaymentOrderID ||
      hasProviderResult ||
      isExpiredMode
    ) {
      return
    }

    let cancelled = false
    const pollOrderStatus = async () => {
      if (cancelled) return
      await refreshActiveOrderStatus()
    }

    pollOrderStatus()
    const intervalID = window.setInterval(pollOrderStatus, 3000)

    return () => {
      cancelled = true
      window.clearInterval(intervalID)
    }
  }, [
    activePaymentOrderID,
    hasProviderResult,
    isExpiredMode,
    isQrisModalOpen,
    refreshActiveOrderStatus
  ])

  // Create QRIS order after account validation is complete.
  const handleInitiate = async () => {
    if (!canCreateOrder || !selectedProduct) return

    setActionNotice(null)
    const finalID = getFinalTargetID()

    setIsCreatingOrder(true)
    try {
      const res = await post('/admin/manual-order', {
        sku: selectedProduct.code,
        target_id: finalID,
        selling_price: sellingPrice,
        manual_order_type: orderType,
        inject_reason: orderNote
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(
          data.reason ||
            data.error ||
            data.message ||
            'Gagal membuat QRIS order'
        )
      }

      const createdOrder = data.data as ManualOrderTransaction
      setManualOrder(createdOrder)
      setQrisOrder(null)
      setFlowStep('QRIS_PAYMENT')
      setIsQrisModalOpen(true)
      setActionNotice({
        type: 'success',
        message: data.message || 'QRIS order berhasil dibuat'
      })

      const newLog: FeedLog = {
        invoice:
          createdOrder.invoice_id || `INV-${Date.now().toString().slice(-6)}`,
        item: selectedProduct.name,
        target: finalID,
        status: 'INFO',
        desc: 'QRIS order created'
      }

      setFeedLogs(prev => [newLog, ...prev].slice(0, 3))
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Gagal membuat QRIS order'

      setActionNotice({ type: 'error', message })
      const failedLog: FeedLog = {
        invoice: 'ERR-ORDER',
        item: selectedProduct.name,
        target: finalID,
        status: 'FAILED',
        desc: message
      }

      setFeedLogs(prev => [failedLog, ...prev].slice(0, 3))
    } finally {
      setIsCreatingOrder(false)
    }
    fetchRunningOrders()
  }

  const executeManualTopup = async (targetOrder?: ManualOrderTransaction) => {
    const activeOrder = targetOrder || activePaymentOrder
    if (!activeOrder) return
    const isManualOrderSource = manualOrder?.ID === activeOrder.ID

    setExecutingOrderIDs(prev =>
      prev.includes(activeOrder.ID) ? prev : [...prev, activeOrder.ID]
    )
    setActionNotice(null)

    try {
      const res = await post(
        `/admin/manual-order/${activeOrder.ID}/execute`,
        {}
      )
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || data.message || 'Gagal execute topup')
      }

      const updatedOrder = data.data as ManualOrderTransaction
      const orderProduct = getOrderProduct(updatedOrder)
      const isFailed =
        updatedOrder.fulfillment_status === 'FAILED' ||
        updatedOrder.status === 'FAILED'

      syncOrderState(updatedOrder)
      if (isManualOrderSource) {
        setFlowStep('FULFILLMENT_RESULT')
      }
      if (!isManualOrderSource && targetOrder) {
        setQrisOrder(updatedOrder)
        setIsRunningModalOpen(false)
        setIsQrisModalOpen(true)
      }
      setActionNotice({
        type: isFailed ? 'error' : 'success',
        message: data.message || 'Topup selesai diproses'
      })

      const resultLog: FeedLog = {
        invoice:
          updatedOrder.invoice_id || `INV-${Date.now().toString().slice(-6)}`,
        item:
          orderProduct?.name ||
          (isManualOrderSource ? selectedProduct?.name : undefined) ||
          'Unknown Item',
        target:
          updatedOrder.customer_phone ||
          activeOrder.customer_phone ||
          getFinalTargetID(),
        status: isFailed ? 'FAILED' : 'SUCCESS',
        desc:
          updatedOrder.serial_number ||
          updatedOrder.sn ||
          updatedOrder.error_message ||
          data.message ||
          '-'
      }

      setFeedLogs(prev => [resultLog, ...prev].slice(0, 3))
      await fetchRunningOrders()
    } catch (error) {
      setActionNotice({
        type: 'error',
        message: error instanceof Error ? error.message : 'Gagal execute topup'
      })
    } finally {
      setExecutingOrderIDs(prev =>
        prev.filter(orderID => orderID !== activeOrder.ID)
      )
    }
  }

  const checkProviderStatus = async () => {
    if (!activePaymentOrder) return

    setIsCheckingProviderStatus(true)
    setActionNotice(null)

    try {
      const res = await post(
        `/admin/manual-order/${activePaymentOrder.ID}/check-provider-status`,
        {}
      )
      const data = await res.json()

      if (!res.ok) {
        throw new Error(
          data.reason ||
            data.error ||
            data.message ||
            'Status provider belum dapat diperbarui'
        )
      }

      const updatedOrder = data.data as ManualOrderTransaction
      syncOrderState(updatedOrder)

      const updatedFulfillmentStatus = getOrderFulfillmentStatus(updatedOrder)
      const isFinalResult =
        updatedFulfillmentStatus === 'SUCCESS' ||
        updatedFulfillmentStatus === 'FAILED'

      if (isFinalResult) {
        setFlowStep('FULFILLMENT_RESULT')
        setActionNotice(null)
        await fetchRunningOrders()
      } else {
        setActionNotice({
          type: 'info',
          message:
            'Status provider masih diproses. Sistem akan memperbarui hasil otomatis setelah update diterima.'
        })
      }
    } catch (error) {
      setActionNotice({
        type: 'info',
        message:
          error instanceof Error
            ? error.message.replace(/gagal|error/gi, 'belum dapat')
            : 'Status provider belum dapat diperbarui. Coba lagi beberapa saat lagi.'
      })
    } finally {
      setIsCheckingProviderStatus(false)
    }
  }

  const getOrderDisplayInfo = (order?: ManualOrderTransaction | null) => {
    if (!order) {
      return {
        productName: 'Produk Manual',
        target: '-'
      }
    }

    const isManualOrderSource = manualOrder?.ID === order.ID
    const orderProduct = getOrderProduct(order)

    return {
      productName:
        orderProduct?.name ||
        (isManualOrderSource ? selectedProduct?.name : undefined) ||
        'Produk Manual',
      target:
        order.customer_phone ||
        (isManualOrderSource ? getFinalTargetID() : '-') ||
        '-'
    }
  }

  const buildWhatsAppResult = () => {
    const order = activePaymentOrder
    if (!order) return ''

    const { productName, target } = getOrderDisplayInfo(order)
    const isSuccess = getOrderFulfillmentStatus(order) === 'SUCCESS'
    const resultText = isSuccess
      ? order.serial_number || order.sn || '-'
      : order.error_message || order.provider_status || '-'

    return [
      `Invoice: ${order.invoice_id}`,
      `Produk: ${productName}`,
      `Target: ${target}`,
      `Status: ${isSuccess ? 'BERHASIL' : 'GAGAL'}`,
      `${isSuccess ? 'SN' : 'Reason'}: ${resultText}`
    ].join('\n')
  }

  const copyWhatsAppResult = async () => {
    const text = buildWhatsAppResult()
    if (!text) return

    await navigator.clipboard.writeText(text)
    setActionNotice({
      type: 'success',
      message: 'Result WhatsApp berhasil dicopy'
    })
  }

  const getProviderResultValue = () => {
    const order = activePaymentOrder
    if (!order) return ''

    const isSuccess = getOrderFulfillmentStatus(order) === 'SUCCESS'

    return isSuccess
      ? order.serial_number || order.sn || ''
      : order.error_message || order.provider_status || ''
  }

  const copyProviderResultValue = async () => {
    const value = getProviderResultValue()
    if (!value) return

    await navigator.clipboard.writeText(value)
    setActionNotice({
      type: 'success',
      message:
        getOrderFulfillmentStatus(activePaymentOrder) === 'SUCCESS'
          ? 'SN berhasil dicopy'
          : 'Reason berhasil dicopy'
    })
  }

  const activeStepIndex = Math.max(
    0,
    SALES_ORDER_STEPS.findIndex(step => step.key === flowStep)
  )

  const paymentURL = activePaymentOrder?.payment_url || ''
  const isPaymentURLImage =
    !!paymentURL &&
    (/\.(png|jpe?g|webp|svg)(\?|$)/i.test(paymentURL) ||
      paymentURL.toLowerCase().includes('qr'))

  const isFulfillmentSuccess = fulfillmentStatus === 'SUCCESS'
  const resultInfo = activePaymentOrder
    ? getOrderDisplayInfo(activePaymentOrder)
    : null
  const providerResultValue = getProviderResultValue()

  return (
    <div className='w-full max-w-[1920px] mx-auto pb-10'>
      {/* HEADER SECTION */}
      <div className='mb-10 flex items-start gap-4'>
        {/* KIRI: JUDUL */}
        <div>
          <h1 className='text-3xl font-black text-white flex items-center gap-3 uppercase tracking-tight'>
            <span className='w-2 h-8 bg-gradient-to-b from-sky-400 to-blue-600 rounded-full'></span>
            Manual Sales Order
          </h1>
          <p className='text-sky-300/70 text-sm mt-1 ml-5 tracking-widest uppercase text-[10px] font-bold'>
            QRIS Manual Order Workflow
          </p>
        </div>
      </div>

      {/* 🔥 BARIS TABS & LOG SYSTEM (SEJAJAR) 🔥 */}
      <div className='mb-6 w-full relative z-30 flex flex-col lg:flex-row items-end justify-between gap-8'>
        {/* KIRI: KATALOG TABS */}
        <div className='flex-1 w-full min-w-0'>
          {!loadingData && catalogs.length > 0 ? (
            <div className='flex gap-2 overflow-x-auto pb-4 custom-scrollbar'>
              {catalogs.map(cat => {
                const isActive = selectedCatalog === cat
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCatalog(cat)}
                    // 🔥 PERBAIKAN: Tambah 'border' statis & 'delay-100' pas jadi inactive 🔥
                    className={`relative px-6 py-2.5 rounded-xl font-bold text-[11px] uppercase tracking-widest whitespace-nowrap outline-none border ${
                      isActive
                        ? 'text-sky-300 border-transparent'
                        : 'text-slate-400 hover:text-slate-200 bg-white/[0.02] border-white/[0.05] transition-colors duration-500 delay-100'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId='activeGlassTab'
                        className='absolute inset-0 bg-sky-500/10 border border-sky-400/40 rounded-xl shadow-[inset_0_1px_2px_rgba(255,255,255,0.1),0_0_15px_rgba(56,189,248,0.15)] backdrop-blur-md'
                        initial={false}
                        transition={{
                          type: 'spring',
                          stiffness: 400,
                          damping: 35
                        }}
                      />
                    )}
                    <span className='relative z-10'>{cat}</span>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className='h-[44px]'></div>
          )}
        </div>

        {/* KANAN: LOG SYSTEM (Sejajar Tabs, di atas Form) */}
        <div className='w-full lg:w-[380px] shrink-0 flex flex-col items-end space-y-1 pointer-events-none pb-4'>
          {feedLogs.length === 0 ? (
            <div className='text-right opacity-30'>
              <div className='font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400'>
                SYSTEM READY...
              </div>
            </div>
          ) : (
            feedLogs.map((log, index) => (
              <div
                key={index}
                className={`font-mono text-[11px] font-bold transition-all duration-500 animate-in slide-in-from-bottom-5 fade-in ${
                  log.status === 'SUCCESS'
                    ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]'
                    : log.status === 'INFO'
                    ? 'text-sky-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.35)]'
                    : 'text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.4)]'
                }`}
              >
                <div className='flex items-center justify-end gap-2'>
                  <span>{log.invoice}</span>
                  <span className='text-white/20'>||</span>
                  <span className='max-w-[150px] truncate'>{log.item}</span>
                  <span className='text-white/20'>||</span>
                  <span>{log.target}</span>
                </div>
                {log.status === 'FAILED' && (
                  <div className='text-[9px] text-red-500/80 text-right pr-1'>
                    └ {log.desc}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* --- MAIN SPLIT LAYOUT (Produk & Form) --- */}
      <div className='flex flex-col lg:flex-row items-start gap-8 relative'>
        {/* KOLOM KIRI: PRODUK */}
        <div className='flex-1 w-full min-w-0'>
          {/* ✨ TAMBAHAN SEARCH & SORT UI DISINI ✨ */}
          {!loadingData && selectedCatalog && (
            <div className='flex flex-col sm:flex-row gap-3 mb-6 relative z-20'>
              {/* Search Input */}
              <div className='relative flex-1'>
                <input
                  type='text'
                  placeholder='Cari nama produk atau SKU (Cth: 1000 VP)...'
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className='w-full bg-white/[0.02] border border-white/[0.05] rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50 focus:bg-white/[0.05] transition-all shadow-[inset_0_1px_2px_rgba(255,255,255,0.02)]'
                />
              </div>

              {/* ↕️ DROPDOWN FILTER & SORT (CLEAN UI) */}
              <select
                value={filterMode}
                onChange={e => setFilterMode(e.target.value)}
                className='px-6 py-3 min-w-[200px] rounded-xl text-[11px] font-bold text-slate-300 bg-white/[0.02] border border-white/[0.05] focus:border-sky-500/50 focus:text-white transition-all outline-none cursor-pointer shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)] uppercase tracking-wider'
              >
                <option value='default' className='bg-[#15173d] text-white'>
                  Semua Produk
                </option>
                <option value='price_asc' className='bg-[#15173d] text-white'>
                  Termurah - Termahal
                </option>
                <option value='price_desc' className='bg-[#15173d] text-white'>
                  Termahal - Termurah
                </option>
                <option
                  value='active_only'
                  className='bg-[#15173d] text-emerald-400'
                >
                  Yang Aktif Saja
                </option>
                <option
                  value='inactive_only'
                  className='bg-[#15173d] text-red-400'
                >
                  Yang Gangguan Saja
                </option>
              </select>
            </div>
          )}
          {/* ✨ BATAS TAMBAHAN ✨ */}

          {loadingData ? (
            <div className='text-center py-20 animate-pulse text-slate-500 uppercase tracking-widest text-xs font-bold font-mono'>
              Syncing Catalog Nodes...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className='rounded-2xl border border-white/[0.06] bg-white/[0.02] px-6 py-16 text-center'>
              <div className='text-sm font-black uppercase tracking-[0.18em] text-white'>
                Produk tidak ditemukan
              </div>
              <p className='mx-auto mt-3 max-w-md text-xs leading-relaxed text-slate-500'>
                Coba ubah kata kunci, status produk, atau urutan harga yang
                dipilih.
              </p>
              <button
                type='button'
                onClick={() => {
                  setSearchTerm('')
                  setFilterMode('price_asc')
                }}
                className='mt-5 rounded-xl border border-sky-400/30 bg-sky-500/15 px-5 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-sky-200 transition-all hover:bg-sky-500/25'
              >
                Reset Filter
              </button>
            </div>
          ) : (
            <div className='grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4'>
              {filteredProducts.map(product => {
                // 🔥 LOGIC GEMBOK: Mati kalau is_active false ATAU stock 0 (tapi bukan -1)
                const isUnavailable =
                  !product.is_active ||
                  (product.stock !== undefined &&
                    product.stock <= 0 &&
                    product.stock !== -1)
                const isSelected = selectedProduct?.code === product.code

                return (
                  <div
                    key={product.code}
                    onClick={() =>
                      !isUnavailable && setSelectedProduct(product)
                    }
                    className={`relative p-5 rounded-2xl border transition-all duration-300 flex flex-col justify-between h-full text-left min-h-[140px] overflow-hidden backdrop-blur-md
                            ${
                              isUnavailable
                                ? 'cursor-not-allowed border-white/[0.02] bg-white/[0.01] opacity-50 grayscale'
                                : 'cursor-pointer hover:bg-white/[0.05] hover:border-white/[0.15] hover:-translate-y-1 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]'
                            }
                            ${
                              isSelected
                                ? 'bg-sky-500/[0.08] border-sky-400/50 shadow-[0_0_20px_rgba(56,189,248,0.2),inset_0_1px_2px_rgba(255,255,255,0.1)]'
                                : !isUnavailable
                                ? 'bg-white/[0.02] border-white/[0.05]'
                                : ''
                            }
                        `}
                  >
                    {/* Indikator Status Kedip */}
                    <div
                      className={`absolute top-4 right-4 w-2 h-2 rounded-full z-10
                            ${
                              isUnavailable
                                ? 'bg-red-500/50'
                                : isSelected
                                ? 'bg-sky-400 animate-pulse shadow-[0_0_10px_#38bdf8]'
                                : 'bg-emerald-500/50'
                            }
                        `}
                    ></div>

                    <div className='flex flex-col h-full relative z-10'>
                      <div className='w-max px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/20 text-[10px] text-sky-300/90 font-mono tracking-widest mb-3 uppercase'>
                        {product.code}
                      </div>
                      <div
                        className={`font-bold text-sm leading-snug mb-4 line-clamp-2 transition-colors ${
                          isSelected ? 'text-white' : 'text-slate-300'
                        }`}
                      >
                        {product.name
                          .replace(product.catalog?.name || '', '')
                          .trim()}
                      </div>
                      <div
                        className={`mt-auto font-mono font-bold text-base tracking-tight transition-colors
                                ${
                                  isUnavailable
                                    ? 'text-slate-600 line-through'
                                    : isSelected
                                    ? 'text-sky-400'
                                    : 'text-[#e491c9]'
                                }
                          `}
                      >
                        <div className='mt-auto space-y-1 font-mono text-xs'>
                          <div className='flex justify-between text-slate-400'>
                            <span>Modal</span>
                            <span>{formatIDR(product.price)}</span>
                          </div>
                          <div className='flex justify-between text-[#e491c9] font-bold'>
                            <span>Jual</span>
                            <span>
                              {formatIDR(Math.round(product.price * 1.05))}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 🔥 OVERLAY GANGGUAN / KOSONG 🔥 */}
                    {isUnavailable && (
                      <div className='absolute inset-0 flex items-center justify-center pointer-events-none z-20 bg-black/20'>
                        <span className='bg-red-500/20 text-red-300 text-[9px] uppercase tracking-[0.2em] font-bold px-3 py-1.5 rounded-full border border-red-500/30 backdrop-blur-md -rotate-12 shadow-[0_0_15px_rgba(239,68,68,0.3)]'>
                          {product.is_active ? 'KOSONG' : 'GANGGUAN'}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* KOLOM KANAN: SALES OPS TABBED PANEL */}
        <div className='w-full lg:w-[380px] shrink-0 lg:sticky lg:top-6 lg:self-start z-20'>
          <GlassCard className='p-0'>
            <div className='px-6 pb-4 pt-6'>
              <h2 className='flex items-center gap-3 text-xs font-black uppercase tracking-widest text-white'>
                <span className='h-4 w-2 rounded-full bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.5)]'></span>
                Sales Ops
              </h2>
              <p className='mt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-sky-300/60'>
                Manual QRIS Workflow
              </p>
            </div>

            <div
              role='tablist'
              aria-label='Sales ops tabs'
              className='mx-6 grid grid-cols-2 gap-0'
            >
              {(['ORDER', 'QUEUE'] as SalesOpsTab[]).map(tab => {
                const isActive = activeOpsTab === tab
                const label =
                  tab === 'QUEUE' ? `QUEUE ${queueSummary.total}` : 'ORDER'

                return (
                  <button
                    key={tab}
                    type='button'
                    role='tab'
                    aria-selected={isActive}
                    onClick={() => setActiveOpsTab(tab)}
                    className={`rounded-t-2xl border border-b-0 px-4 py-3 text-center font-mono text-[11px] font-black uppercase tracking-[0.18em] transition-all ${
                      isActive
                        ? 'border-white/[0.08] bg-white/[0.045] text-sky-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]'
                        : 'border-white/[0.04] bg-white/[0.015] text-slate-500 hover:bg-white/[0.03] hover:text-slate-300'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>

            <div className='mx-6 mb-6 rounded-b-[24px] border border-t-0 border-white/[0.08] bg-white/[0.045] p-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]'>
              {activeOpsTab === 'ORDER' ? (
                <div>
                  <div className='mb-4 grid grid-cols-4 gap-2'>
                    {SALES_ORDER_STEPS.map((step, index) => {
                      const isActive = index === activeStepIndex
                      const isDone = index < activeStepIndex

                      return (
                        <div
                          key={step.key}
                          className={`rounded-xl border px-2 py-2 text-center transition-all ${
                            isActive
                              ? 'border-sky-400/40 bg-sky-500/10 text-sky-300'
                              : isDone
                              ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-300'
                              : 'border-white/[0.05] bg-white/[0.02] text-slate-500'
                          }`}
                        >
                          <div className='font-mono text-[10px] font-black'>
                            {index + 1}
                          </div>
                          <div className='mt-1 truncate text-[8px] font-bold uppercase tracking-widest'>
                            {step.label}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className='space-y-4'>
                    {!selectedProduct && !manualOrder && (
                      <div className='rounded-xl border border-white/[0.06] bg-white/[0.03] p-5 text-center'>
                        <div className='text-[10px] font-black uppercase tracking-[0.24em] text-sky-300'>
                          Pilih Produk
                        </div>
                        <p className='mt-3 text-xs leading-relaxed text-slate-400'>
                          Pilih produk dari katalog di kiri untuk mulai membuat
                          QRIS manual sales order.
                        </p>
                      </div>
                    )}

                    {selectedProduct && !manualOrder && (
                      <div className='space-y-4'>
                        {/* INPUT 1 */}
                        <div>
                          <label className='text-[10px] font-bold text-slate-400 mb-2 block uppercase tracking-widest'>
                            {currentSchema.label1}
                          </label>
                          <input
                            type='text'
                            placeholder={currentSchema.placeholder1}
                            value={input1}
                            onChange={e => setInput1(e.target.value)}
                            className='w-full bg-white/[0.03] border border-white/10 text-white font-mono text-sm px-4 py-3 rounded-xl focus:border-sky-400 focus:bg-white/[0.05] focus:shadow-[0_0_15px_rgba(56,189,248,0.15)] outline-none transition-all placeholder:text-slate-600'
                          />
                          {currentSchema.info && (
                            <p className='text-[10px] text-amber-500/80 mt-2 font-mono'>
                              {currentSchema.info}
                            </p>
                          )}
                        </div>

                        {/* INPUT 2 */}
                        {currentSchema.type === 'ZONE' && (
                          <div>
                            <label className='text-[10px] font-bold text-slate-400 mb-2 block uppercase tracking-widest'>
                              {currentSchema.label2}
                            </label>
                            <input
                              type='text'
                              placeholder='(1234)'
                              value={input2}
                              onChange={e => setInput2(e.target.value)}
                              className='w-full bg-white/[0.03] border border-white/10 text-white font-mono text-sm px-4 py-3 rounded-xl focus:border-sky-400 focus:bg-white/[0.05] focus:shadow-[0_0_15px_rgba(56,189,248,0.15)] outline-none transition-all placeholder:text-slate-600'
                            />
                          </div>
                        )}

                        {currentSchema.type === 'SERVER' &&
                          currentSchema.servers && (
                            <div>
                              <label className='text-[10px] font-bold text-slate-400 mb-2 block uppercase tracking-widest'>
                                Server Target
                              </label>
                              <select
                                value={input2}
                                onChange={e => setInput2(e.target.value)}
                                className='w-full bg-[#15173d] border border-white/10 text-white font-mono text-sm px-4 py-3 rounded-xl focus:border-sky-400 outline-none cursor-pointer'
                              >
                                <option value='' className='bg-[#15173d]'>
                                  -- Pilih Region --
                                </option>
                                {currentSchema.servers.map(opt => (
                                  <option
                                    key={opt.id}
                                    value={opt.id}
                                    className='bg-[#15173d]'
                                  >
                                    {opt.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                        {supportsAccountCheck && isTargetComplete && (
                          <div aria-live='polite'>
                            {accountCheckStatus === 'CHECKING' && (
                              <div className='flex items-center gap-3 rounded-xl border border-sky-400/20 bg-sky-500/10 px-4 py-3'>
                                <span className='h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-sky-300 border-t-transparent' />
                                <div>
                                  <div className='text-xs font-black text-sky-200'>
                                    Memeriksa akun...
                                  </div>
                                  <div className='mt-1 text-[10px] text-sky-200/60'>
                                    Validasi berjalan otomatis.
                                  </div>
                                </div>
                              </div>
                            )}

                            {accountCheckStatus === 'VALID' && (
                              <div className='flex items-start gap-3 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3'>
                                <span className='mt-0.5 text-emerald-300'>
                                  ✓
                                </span>
                                <div className='min-w-0'>
                                  <div className='text-[10px] font-black uppercase tracking-widest text-emerald-300/70'>
                                    Akun ditemukan
                                  </div>
                                  <div className='mt-1 break-words text-sm font-black text-emerald-100'>
                                    {nickname || 'Nickname ditemukan'}
                                  </div>
                                </div>
                              </div>
                            )}

                            {accountCheckStatus === 'INVALID' && (
                              <div className='rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3'>
                                <div className='flex items-start gap-3'>
                                  <span className='mt-0.5 text-red-300'>✕</span>
                                  <div className='min-w-0 flex-1'>
                                    <div className='text-xs font-black text-red-200'>
                                      Akun tidak ditemukan
                                    </div>
                                    <div className='mt-1 text-[10px] leading-relaxed text-red-200/70'>
                                      {accountCheckMessage}
                                    </div>
                                  </div>
                                </div>
                                <button
                                  type='button'
                                  onClick={retryAccountCheck}
                                  className='mt-3 w-full rounded-lg border border-red-400/20 bg-red-500/10 py-2 text-[10px] font-black uppercase tracking-widest text-red-200 hover:bg-red-500/20'
                                >
                                  Cek Ulang
                                </button>
                              </div>
                            )}

                            {accountCheckStatus === 'UNAVAILABLE' && (
                              <div className='rounded-xl border border-yellow-400/20 bg-yellow-500/10 px-4 py-3'>
                                <div className='flex items-start gap-3'>
                                  <span className='mt-0.5 text-yellow-200'>
                                    !
                                  </span>
                                  <div className='min-w-0 flex-1'>
                                    <div className='text-xs font-black text-yellow-100'>
                                      Checker tidak tersedia
                                    </div>
                                    <div className='mt-1 text-[10px] leading-relaxed text-yellow-100/70'>
                                      {accountCheckMessage}
                                    </div>
                                  </div>
                                </div>
                                <div className='mt-3 grid grid-cols-2 gap-2'>
                                  <button
                                    type='button'
                                    onClick={retryAccountCheck}
                                    className='rounded-lg border border-yellow-400/20 bg-yellow-500/10 py-2 text-[10px] font-black uppercase tracking-widest text-yellow-100 hover:bg-yellow-500/20'
                                  >
                                    Cek Ulang
                                  </button>
                                  <button
                                    type='button'
                                    onClick={continueWithoutAccountCheck}
                                    className='rounded-lg border border-white/[0.08] bg-white/[0.04] py-2 text-[10px] font-black uppercase tracking-widest text-slate-200 hover:bg-white/[0.08]'
                                  >
                                    Lanjut Manual
                                  </button>
                                </div>
                              </div>
                            )}

                            {accountCheckStatus === 'MANUAL' && (
                              <div className='flex items-start gap-3 rounded-xl border border-yellow-400/20 bg-yellow-500/10 px-4 py-3'>
                                <span className='mt-0.5 text-yellow-200'>
                                  !
                                </span>
                                <div>
                                  <div className='text-xs font-black text-yellow-100'>
                                    Validasi dilewati
                                  </div>
                                  <div className='mt-1 text-[10px] leading-relaxed text-yellow-100/70'>
                                    {accountCheckMessage}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* REVIEW HARGA */}
                        <div className='space-y-3 rounded-xl border border-white/[0.05] bg-white/[0.02] p-4 shadow-[inset_0_1px_2px_rgba(255,255,255,0.02)]'>
                          <div className='flex items-center justify-between'>
                            <span className='text-[10px] font-bold uppercase tracking-widest text-slate-500'>
                              Harga Web / Maks
                            </span>
                            <span className='font-mono text-sm font-bold text-sky-300'>
                              {selectedProduct ? formatIDR(webPrice) : 'Rp 0'}
                            </span>
                          </div>

                          <div>
                            <label className='mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-400'>
                              Harga Jual Manual
                            </label>

                            <div className='grid grid-cols-5 gap-2'>
                              {[0, 1, 2, 3, 5].map(percent => (
                                <button
                                  key={percent}
                                  type='button'
                                  onClick={() => applyMarkup(percent)}
                                  disabled={!selectedProduct}
                                  className='rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-2 font-mono text-[10px] font-black text-slate-300 transition-all hover:border-sky-400/40 hover:bg-sky-500/10 hover:text-sky-300 disabled:cursor-not-allowed disabled:opacity-40'
                                >
                                  {percent}%
                                </button>
                              ))}
                            </div>

                            {priceError && (
                              <p className='mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-red-300'>
                                {priceError}
                              </p>
                            )}

                            <div className='relative mt-4'>
                              <span className='pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 font-mono text-xs font-bold text-slate-500'>
                                Rp
                              </span>
                              <input
                                type='text'
                                inputMode='numeric'
                                value={
                                  sellingPriceInput
                                    ? Number(sellingPriceInput).toLocaleString(
                                        'id-ID'
                                      )
                                    : ''
                                }
                                onChange={e =>
                                  handleSellingPriceChange(e.target.value)
                                }
                                disabled={!selectedProduct}
                                placeholder='0'
                                className='w-full rounded-xl border border-white/10 bg-white/[0.03] py-3 pl-10 pr-4 text-right font-mono text-sm font-bold text-white outline-none transition-all placeholder:text-slate-600 focus:border-sky-400 focus:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-50'
                              />
                            </div>
                          </div>

                          <div className='rounded-xl border border-white/[0.05] bg-black/10 p-3'>
                            <div className='flex items-center justify-between'>
                              <span className='text-[10px] font-bold uppercase tracking-widest text-slate-500'>
                                Profit Real
                              </span>
                              <span
                                className={`font-mono text-base font-black ${
                                  profit > 0
                                    ? 'text-emerald-400'
                                    : profit < 0
                                    ? 'text-red-400'
                                    : 'text-slate-400'
                                }`}
                              >
                                {profit > 0 ? '+' : ''}
                                {selectedProduct ? formatIDR(profit) : 'Rp 0'}
                              </span>
                            </div>
                            <p className='mt-1 text-right text-[9px] font-mono uppercase tracking-widest text-slate-600'>
                              {profit > 0
                                ? 'Markup aktif'
                                : profit < 0
                                ? 'Harga di bawah modal'
                                : 'Jual harga modal'}
                            </p>
                          </div>

                          {selectedProduct && (
                            <div className='truncate text-right font-mono text-[10px] uppercase text-slate-500'>
                              {selectedProduct.name}
                            </div>
                          )}
                        </div>

                        <div>
                          <label className='mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-400'>
                            Tipe Order
                          </label>
                          <select
                            value={orderType}
                            onChange={e => {
                              setOrderType(e.target.value)
                              setInjectReason('')
                            }}
                            className='w-full rounded-xl border border-white/10 bg-[#15173d] px-4 py-3 text-sm font-bold text-white outline-none transition-all focus:border-sky-400'
                          >
                            {MANUAL_ORDER_TYPES.map(type => (
                              <option
                                key={type}
                                value={type}
                                className='bg-[#15173d]'
                              >
                                {type}
                              </option>
                            ))}
                          </select>

                          {requiresOrderNote && (
                            <textarea
                              value={injectReason}
                              onChange={e => setInjectReason(e.target.value)}
                              rows={3}
                              placeholder='Catatan order manual...'
                              className='mt-3 w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-slate-600 focus:border-sky-400 focus:bg-white/[0.05] focus:shadow-[0_0_15px_rgba(56,189,248,0.15)]'
                            />
                          )}
                        </div>

                        {actionNotice && (
                          <div
                            className={`rounded-xl border px-4 py-3 text-xs font-bold ${
                              actionNotice.type === 'success'
                                ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300'
                                : actionNotice.type === 'error'
                                ? 'border-red-400/20 bg-red-500/10 text-red-300'
                                : 'border-sky-400/20 bg-sky-500/10 text-sky-300'
                            }`}
                          >
                            {actionNotice.message}
                          </div>
                        )}

                        <button
                          type='button'
                          onClick={handleInitiate}
                          disabled={!canCreateOrder}
                          className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-[0.2em] shadow-lg transition-all duration-300 flex items-center justify-center gap-3 border ${
                            !canCreateOrder
                              ? 'bg-white/[0.02] text-slate-600 border-white/[0.05] cursor-not-allowed'
                              : 'bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border-sky-500/30 hover:border-sky-500/50 hover:shadow-[0_0_20px_rgba(56,189,248,0.3)] shadow-[inset_0_1px_2px_rgba(255,255,255,0.2)]'
                          }`}
                        >
                          {isCreatingOrder ? (
                            <span className='flex items-center gap-3'>
                              <span className='h-4 w-4 animate-spin rounded-full border-2 border-sky-400 border-t-transparent' />
                              <span>Creating...</span>
                            </span>
                          ) : accountCheckStatus === 'CHECKING' ? (
                            'CHECKING ACCOUNT...'
                          ) : (
                            'CREATE QRIS ORDER'
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className='space-y-4'>
                  <div className='rounded-2xl border border-white/[0.06] bg-black/10 p-4'>
                    <div className='flex items-start justify-between gap-3'>
                      <div>
                        <div className='text-[10px] font-black uppercase tracking-[0.24em] text-sky-300'>
                          Running Orders
                        </div>
                        <div className='mt-2 font-mono text-2xl font-black text-white'>
                          {queueSummary.total}
                        </div>
                      </div>

                      <button
                        type='button'
                        onClick={() => fetchRunningOrders()}
                        disabled={loadingRunningOrders}
                        className='rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 font-mono text-[10px] font-black uppercase tracking-widest text-slate-400 transition-all hover:border-sky-400/30 hover:text-sky-300 disabled:cursor-not-allowed disabled:opacity-50'
                      >
                        {loadingRunningOrders ? 'Sync...' : 'Refresh'}
                      </button>
                    </div>

                    <div className='mt-4 grid grid-cols-3 gap-2'>
                      <div className='rounded-xl border border-yellow-400/15 bg-yellow-500/10 p-3 text-center'>
                        <div className='font-mono text-sm font-black text-yellow-200'>
                          {queueSummary.unpaid}
                        </div>
                        <div className='mt-1 text-[8px] font-black uppercase tracking-widest text-yellow-200/70'>
                          Unpaid
                        </div>
                      </div>

                      <div className='rounded-xl border border-emerald-400/15 bg-emerald-500/10 p-3 text-center'>
                        <div className='font-mono text-sm font-black text-emerald-300'>
                          {queueSummary.ready}
                        </div>
                        <div className='mt-1 text-[8px] font-black uppercase tracking-widest text-emerald-300/70'>
                          Ready
                        </div>
                      </div>

                      <div className='rounded-xl border border-sky-400/15 bg-sky-500/10 p-3 text-center'>
                        <div className='font-mono text-sm font-black text-sky-300'>
                          {queueSummary.processing}
                        </div>
                        <div className='mt-1 text-[8px] font-black uppercase tracking-widest text-sky-300/70'>
                          Proc
                        </div>
                      </div>
                    </div>
                  </div>

                  {queuePreview.length === 0 ? (
                    <div className='rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6 text-center'>
                      <div className='text-2xl'>✅</div>
                      <div className='mt-3 text-[10px] font-black uppercase tracking-[0.2em] text-white'>
                        Queue Kosong
                      </div>
                      <p className='mt-2 text-xs leading-relaxed text-slate-500'>
                        Belum ada manual order yang perlu dilanjutkan.
                      </p>
                    </div>
                  ) : (
                    <div className='space-y-3'>
                      {queuePreview.map(order => {
                        const orderProduct = getOrderProduct(order)
                        const orderPaymentStatus = getOrderPaymentStatus(order)
                        const orderFulfillmentStatus =
                          getOrderFulfillmentStatus(order)

                        const isExecutingThisOrder = executingOrderIDs.includes(
                          order.ID
                        )
                        const canRunExecute =
                          orderPaymentStatus === 'PAID' &&
                          orderFulfillmentStatus === 'READY' &&
                          !isExecutingThisOrder

                        return (
                          <div
                            key={order.ID}
                            className='rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4'
                          >
                            <div className='flex items-start justify-between gap-3'>
                              <div className='min-w-0'>
                                <div className='truncate font-mono text-[11px] font-black text-white'>
                                  {order.invoice_id}
                                </div>
                                <div className='mt-2 line-clamp-1 text-xs font-bold text-slate-300'>
                                  {orderProduct?.name || 'Produk Manual'}
                                </div>
                                <div className='mt-2 font-mono text-[10px] uppercase tracking-widest text-slate-500'>
                                  {formatIDR(order.amount || 0)} ·{' '}
                                  {order.customer_phone || '-'}
                                </div>
                              </div>

                              <div className='shrink-0 text-right'>
                                <div
                                  className={`rounded-full border px-2 py-1 font-mono text-[9px] font-black uppercase ${getStatusChipClass(
                                    orderPaymentStatus
                                  )}`}
                                >
                                  {orderPaymentStatus}
                                </div>
                                <div
                                  className={`mt-2 rounded-full border px-2 py-1 font-mono text-[9px] font-black uppercase ${getStatusChipClass(
                                    orderFulfillmentStatus
                                  )}`}
                                >
                                  {orderFulfillmentStatus}
                                </div>
                              </div>
                            </div>

                            <div className='mt-4 grid grid-cols-2 gap-2'>
                              <button
                                type='button'
                                onClick={() => openRunningOrder(order)}
                                className='rounded-xl border border-sky-400/30 bg-sky-500/15 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-sky-200 hover:bg-sky-500/25'
                              >
                                {getQueuePrimaryActionLabel(order)}
                              </button>

                              <button
                                type='button'
                                onClick={() => executeManualTopup(order)}
                                disabled={!canRunExecute}
                                className={`rounded-xl border py-3 text-[10px] font-black uppercase tracking-[0.16em] ${
                                  !canRunExecute
                                    ? 'cursor-not-allowed border-white/[0.05] bg-white/[0.02] text-slate-600'
                                    : 'border-[#e491c9]/30 bg-[#e491c9]/15 text-[#f1b7dc] hover:bg-[#e491c9]/25'
                                }`}
                              >
                                {isExecutingThisOrder
                                  ? 'Executing...'
                                  : 'Execute'}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  <button
                    type='button'
                    onClick={() => {
                      setIsRunningModalOpen(true)
                      fetchRunningOrders()
                    }}
                    className='w-full rounded-xl border border-sky-400/30 bg-sky-500/15 py-4 text-xs font-black uppercase tracking-[0.2em] text-sky-200 transition-all hover:bg-sky-500/25'
                  >
                    Lihat Semua Queue
                  </button>
                </div>
              )}
            </div>
          </GlassCard>
        </div>

        {/* DIV PENUTUP KONTEN BAWAH */}
      </div>

      {isRunningModalOpen && (
        <div className='fixed inset-0 z-[998] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-xl'>
          <div className='relative z-10 w-full max-w-3xl overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#07091f]/95 shadow-[0_30px_100px_rgba(0,0,0,0.7)]'>
            <div className='flex items-start justify-between gap-4 border-b border-white/[0.06] px-6 py-5'>
              <div>
                <div className='text-[10px] font-black uppercase tracking-[0.25em] text-sky-300'>
                  Running Orders
                </div>
                <h2 className='mt-1 text-lg font-black text-white'>
                  Transaksi Berjalan
                </h2>
                <p className='mt-1 text-xs text-slate-500'>
                  Order manual yang masih menunggu pembayaran, siap diproses,
                  atau sedang diproses provider.
                </p>
              </div>

              <button
                type='button'
                onClick={() => setIsRunningModalOpen(false)}
                className='rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs font-black text-slate-400 hover:border-red-400/30 hover:text-red-300'
              >
                ✕
              </button>
            </div>

            <div className='max-h-[75vh] overflow-y-auto px-6 py-6 custom-scrollbar'>
              {loadingRunningOrders ? (
                <div className='py-10 text-center font-mono text-xs font-black uppercase tracking-[0.2em] text-slate-500'>
                  Loading transaksi berjalan...
                </div>
              ) : runningOrders.length === 0 ? (
                <div className='rounded-2xl border border-white/[0.06] bg-white/[0.03] p-8 text-center'>
                  <div className='text-2xl'>✅</div>
                  <div className='mt-3 text-xs font-black uppercase tracking-[0.2em] text-white'>
                    Tidak ada transaksi berjalan
                  </div>
                  <p className='mt-2 text-xs text-slate-500'>
                    Semua manual order sudah selesai atau belum ada order baru.
                  </p>
                </div>
              ) : (
                <div className='space-y-3'>
                  {runningOrders.map(order => {
                    const orderProduct = getOrderProduct(order)
                    const orderPaymentStatus = getOrderPaymentStatus(order)
                    const orderFulfillmentStatus =
                      getOrderFulfillmentStatus(order)

                    const isExecutingThisOrder = executingOrderIDs.includes(
                      order.ID
                    )
                    const canRunExecute =
                      orderPaymentStatus === 'PAID' &&
                      orderFulfillmentStatus === 'READY' &&
                      !isExecutingThisOrder

                    return (
                      <div
                        key={order.ID}
                        className='rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4'
                      >
                        <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
                          <div className='min-w-0'>
                            <div className='font-mono text-xs font-black text-white'>
                              {order.invoice_id}
                            </div>

                            <div className='mt-2 line-clamp-1 text-sm font-bold text-slate-300'>
                              {orderProduct?.name || 'Produk Manual'}
                            </div>

                            <div className='mt-2 grid grid-cols-1 gap-1 font-mono text-[10px] uppercase tracking-widest text-slate-500 sm:grid-cols-2'>
                              <div>Target: {order.customer_phone || '-'}</div>
                              <div>Total: {formatIDR(order.amount || 0)}</div>
                              <div>
                                Created: {formatDateTime(order.CreatedAt)}
                              </div>
                              <div>
                                Updated: {formatDateTime(order.UpdatedAt)}
                              </div>
                            </div>
                          </div>

                          <div className='flex flex-wrap gap-2 lg:justify-end'>
                            <span
                              className={`rounded-full border px-3 py-1 font-mono text-[10px] font-black uppercase tracking-widest ${getStatusChipClass(
                                orderPaymentStatus
                              )}`}
                            >
                              {orderPaymentStatus}
                            </span>

                            <span
                              className={`rounded-full border px-3 py-1 font-mono text-[10px] font-black uppercase tracking-widest ${getStatusChipClass(
                                orderFulfillmentStatus
                              )}`}
                            >
                              {orderFulfillmentStatus}
                            </span>
                          </div>
                        </div>

                        <div className='mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2'>
                          <button
                            type='button'
                            onClick={() => openRunningOrder(order)}
                            className='rounded-xl border border-sky-400/30 bg-sky-500/15 py-3 text-xs font-black uppercase tracking-[0.16em] text-sky-200 hover:bg-sky-500/25'
                          >
                            {getQueuePrimaryActionLabel(order)}
                          </button>

                          <button
                            type='button'
                            onClick={() => executeManualTopup(order)}
                            disabled={!canRunExecute}
                            className={`rounded-xl border py-3 text-xs font-black uppercase tracking-[0.16em] ${
                              !canRunExecute
                                ? 'cursor-not-allowed border-white/[0.05] bg-white/[0.02] text-slate-600'
                                : 'border-[#e491c9]/30 bg-[#e491c9]/15 text-[#f1b7dc] hover:bg-[#e491c9]/25'
                            }`}
                          >
                            {isExecutingThisOrder ? 'Executing...' : 'Execute'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isQrisModalOpen && activePaymentOrder && (
        <div className='fixed inset-0 z-[999] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-xl'>
          <div className='absolute inset-0' />

          <div
            className={`relative z-10 w-full ${modalWidthClass} overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#07091f]/95 shadow-[0_30px_100px_rgba(0,0,0,0.7)]`}
          >
            <div className='flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4'>
              <div className='min-w-0'>
                <div
                  className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${modalModeClass}`}
                >
                  {modalModeLabel}
                </div>
                <div className='mt-2 truncate font-mono text-xs font-black text-white'>
                  {activePaymentOrder.invoice_id}
                </div>
              </div>

              <button
                type='button'
                onClick={closeQrisModal}
                className='rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs font-black text-slate-400 hover:border-red-400/30 hover:text-red-300'
              >
                ✕
              </button>
            </div>

            <div className='max-h-[75vh] overflow-y-auto px-6 py-6 custom-scrollbar'>
              {shouldShowModalNotice && actionNotice && (
                <div
                  className={`mb-5 rounded-xl border px-4 py-3 text-xs font-bold ${
                    actionNotice.type === 'success'
                      ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300'
                      : actionNotice.type === 'error'
                      ? 'border-red-400/20 bg-red-500/10 text-red-300'
                      : 'border-sky-400/20 bg-sky-500/10 text-sky-300'
                  }`}
                >
                  {actionNotice.message}
                </div>
              )}

              {shouldShowQrisContent && (
                <div className='space-y-5'>
                  <div className='rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4'>
                    <div className='flex items-start justify-between gap-3'>
                      <div>
                        <div className='text-[10px] font-bold text-slate-500'>
                          Harga Jual
                        </div>
                        <div className='mt-1 font-mono text-xl font-black text-white'>
                          {formatIDR(activePaymentOrder.amount || sellingPrice)}
                        </div>
                      </div>
                      <span
                        className={`rounded-full border px-3 py-1 font-mono text-[10px] font-black ${getStatusChipClass(
                          paymentStatus || 'UNPAID'
                        )}`}
                      >
                        {paymentStatus || 'UNPAID'}
                      </span>
                    </div>
                  </div>

                  <div className='rounded-2xl border border-white/[0.06] bg-black/25 p-5 text-center'>
                    {paymentURL ? (
                      <div className='space-y-4'>
                        {isPaymentURLImage ? (
                          <div>
                            <Image
                              src={paymentURL}
                              alt='QRIS Payment'
                              width={240}
                              height={240}
                              unoptimized
                              className='mx-auto h-60 w-60 rounded-2xl bg-white p-3 object-contain'
                            />

                            <a
                              href={paymentURL}
                              target='_blank'
                              rel='noreferrer'
                              className='mt-4 inline-flex w-full justify-center rounded-xl border border-sky-400/30 bg-sky-500/15 px-4 py-3 text-xs font-black text-sky-200 hover:bg-sky-500/25'
                            >
                              Buka QRIS
                            </a>
                          </div>
                        ) : (
                          <a
                            href={paymentURL}
                            target='_blank'
                            rel='noreferrer'
                            className='inline-flex w-full justify-center rounded-xl border border-sky-400/30 bg-sky-500/15 px-4 py-3 text-xs font-black text-sky-200 hover:bg-sky-500/25'
                          >
                            Buka Halaman Pembayaran
                          </a>
                        )}
                      </div>
                    ) : (
                      <div className='rounded-xl border border-yellow-400/20 bg-yellow-500/10 p-4 text-left'>
                        <div className='text-xs font-black uppercase tracking-widest text-yellow-200'>
                          QRIS belum tersedia
                        </div>
                        <p className='mt-2 text-xs leading-relaxed text-yellow-100/80'>
                          Backend belum mengirim payment_url. Cek response
                          Tripay / field payment_url.
                        </p>
                      </div>
                    )}
                  </div>

                  <p className='text-center text-[11px] leading-relaxed text-slate-500'>
                    Setelah pembayaran PAID, topup akan diproses otomatis.
                  </p>
                </div>
              )}

              {isExpiredMode && activePaymentOrder && resultInfo && (
                <div className='space-y-5'>
                  <div className='text-center'>
                    <div
                      className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full border font-mono text-lg font-black ${
                        isPaymentFailedMode
                          ? 'border-red-400/20 bg-red-500/10 text-red-200'
                          : 'border-yellow-400/20 bg-yellow-500/10 text-yellow-200'
                      }`}
                    >
                      !
                    </div>
                    <div className='mt-3 text-lg font-black text-white'>
                      {isPaymentFailedMode
                        ? 'Pembayaran Gagal'
                        : 'Pembayaran Kedaluwarsa'}
                    </div>
                    <p
                      className={`mt-2 text-sm font-bold ${
                        isPaymentFailedMode ? 'text-red-200' : 'text-yellow-200'
                      }`}
                    >
                      {isPaymentFailedMode
                        ? 'Pembayaran tidak berhasil.'
                        : 'QRIS sudah tidak berlaku.'}
                    </p>
                    <p className='mx-auto mt-2 max-w-sm text-xs leading-relaxed text-slate-400'>
                      {isPaymentFailedMode
                        ? 'Pembayaran gagal diproses oleh payment gateway. Buat order baru jika customer masih ingin melanjutkan transaksi.'
                        : 'QRIS sudah tidak berlaku. Buat order baru jika customer masih ingin melanjutkan transaksi.'}
                    </p>
                  </div>

                  <div className='space-y-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4'>
                    {[
                      ['Payment Status', paymentStatus || 'EXPIRED'],
                      ['Produk', resultInfo.productName],
                      ['Target', resultInfo.target],
                      [
                        'Harga Jual',
                        formatIDR(activePaymentOrder.amount || sellingPrice)
                      ]
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className='flex items-start justify-between gap-4 text-sm'
                      >
                        <span className='text-slate-500'>{label}</span>
                        <span className='min-w-0 break-all text-right font-mono font-bold text-slate-100'>
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className='grid grid-cols-2 gap-3'>
                    <button
                      type='button'
                      onClick={handleModalNewOrder}
                      className='w-full rounded-xl border border-sky-400/30 bg-sky-500/15 py-3 text-xs font-black text-sky-200 hover:bg-sky-500/25'
                    >
                      New Order
                    </button>

                    <button
                      type='button'
                      onClick={closeQrisModal}
                      className='w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-3 text-xs font-black text-slate-300 hover:bg-white/[0.06]'
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
              {isReadyMode && activePaymentOrder && resultInfo && (
                <div className='space-y-5'>
                  <div className='text-center'>
                    <div className='mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-[#e491c9]/25 bg-[#e491c9]/10 text-lg font-black text-[#f1b7dc]'>
                      ✓
                    </div>
                    <div className='mt-4 text-lg font-black text-white'>
                      Pembayaran Berhasil
                    </div>
                    <p className='mt-1 text-sm font-bold text-[#f1b7dc]'>
                      Order siap diproses
                    </p>
                    <p className='mx-auto mt-2 max-w-sm text-xs leading-relaxed text-slate-400'>
                      Pembayaran sudah diterima, tetapi request ke provider
                      belum dikirim. Jalankan topup untuk melanjutkan
                      fulfillment.
                    </p>
                  </div>

                  <div className='space-y-3 text-left'>
                    {[
                      {
                        label: 'Pembayaran diterima',
                        state: 'done'
                      },
                      {
                        label: 'Order siap dieksekusi',
                        state: 'done'
                      },
                      {
                        label: 'Request provider belum dikirim',
                        state: 'waiting'
                      }
                    ].map(step => (
                      <div
                        key={step.label}
                        className='flex items-center gap-3 text-sm text-slate-200'
                      >
                        <span
                          className={`w-5 ${
                            step.state === 'done'
                              ? 'text-emerald-300'
                              : 'text-slate-500'
                          }`}
                        >
                          {step.state === 'done' ? '✓' : '○'}
                        </span>
                        <span>{step.label}</span>
                      </div>
                    ))}
                  </div>

                  <div className='space-y-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4'>
                    {[
                      ['Produk', resultInfo.productName],
                      ['Target', resultInfo.target],
                      [
                        'Harga Jual',
                        formatIDR(activePaymentOrder.amount || sellingPrice)
                      ]
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className='flex items-start justify-between gap-4 text-sm'
                      >
                        <span className='text-slate-500'>{label}</span>
                        <span className='min-w-0 break-all text-right font-mono font-bold text-slate-100'>
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>

                  <button
                    type='button'
                    onClick={() => executeManualTopup()}
                    disabled={executingOrderIDs.includes(activePaymentOrder.ID)}
                    className={`w-full rounded-xl border py-3 text-xs font-black ${
                      executingOrderIDs.includes(activePaymentOrder.ID)
                        ? 'cursor-not-allowed border-white/[0.05] bg-white/[0.02] text-slate-600'
                        : 'border-[#e491c9]/30 bg-[#e491c9]/15 text-[#f1b7dc] hover:bg-[#e491c9]/25'
                    }`}
                  >
                    {executingOrderIDs.includes(activePaymentOrder.ID)
                      ? 'Executing...'
                      : 'Execute Topup'}
                  </button>
                </div>
              )}

              {isProcessingMode && (
                <div className='space-y-5 text-center'>
                  <div className='text-center'>
                    <div className='mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-sky-400/20 bg-sky-500/10'>
                      <span className='h-5 w-5 animate-spin rounded-full border-2 border-sky-300 border-t-transparent' />
                    </div>
                    <div className='mt-4 text-lg font-black text-white'>
                      Pembayaran Berhasil
                    </div>
                    <p className='mt-1 text-sm font-bold text-sky-200'>
                      Topup sedang diproses
                    </p>
                    <p className='mx-auto mt-2 max-w-sm text-xs leading-relaxed text-slate-400'>
                      Menunggu hasil final dari Digiflazz. Status akan berubah
                      otomatis jika webhook provider sudah masuk.
                    </p>
                  </div>

                  <div className='space-y-3 text-left'>
                    {[
                      {
                        label: 'Pembayaran diterima',
                        state: 'done'
                      },
                      {
                        label: 'Request provider dikirim',
                        state: 'done'
                      },
                      {
                        label: 'Menunggu hasil final Digiflazz',
                        state: 'loading'
                      }
                    ].map(step => (
                      <div
                        key={step.label}
                        className='flex items-center gap-3 text-sm text-slate-200'
                      >
                        {step.state === 'done' ? (
                          <span className='w-5 text-emerald-300'>✓</span>
                        ) : (
                          <span className='h-4 w-4 animate-spin rounded-full border-2 border-sky-300 border-t-transparent' />
                        )}
                        <span>{step.label}</span>
                      </div>
                    ))}
                  </div>

                  <div className='space-y-2 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 text-left text-sm'>
                    <div className='flex items-center justify-between gap-3'>
                      <span className='text-slate-500'>Provider Ref</span>
                      <span className='min-w-0 break-all text-right font-mono text-xs font-bold text-slate-200'>
                        {activePaymentOrder.provider_ref || '-'}
                      </span>
                    </div>
                    <div className='flex items-center justify-between gap-3'>
                      <span className='text-slate-500'>Status</span>
                      <span className='font-mono text-xs font-bold text-sky-200'>
                        Pending
                      </span>
                    </div>
                  </div>

                  <button
                    type='button'
                    onClick={checkProviderStatus}
                    disabled={isCheckingProviderStatus}
                    className={`w-full rounded-xl border py-3 text-xs font-black ${
                      isCheckingProviderStatus
                        ? 'cursor-not-allowed border-white/[0.05] bg-white/[0.02] text-slate-600'
                        : 'border-sky-400/30 bg-sky-500/15 text-sky-200 hover:bg-sky-500/25'
                    }`}
                  >
                    {isCheckingProviderStatus
                      ? 'Checking...'
                      : 'Cek Status Provider'}
                  </button>

                  <p className='text-[10px] leading-relaxed text-slate-500'>
                    Gunakan tombol cek status hanya jika status belum berubah
                    dalam beberapa saat.
                  </p>
                </div>
              )}

              {isResultMode && activePaymentOrder && resultInfo && (
                <div className='space-y-5'>
                  <div className='text-center'>
                    <div className='flex justify-center'>
                      <Lottie
                        animationData={
                          isFulfillmentSuccess ? successAnim : errorAnim
                        }
                        loop={true}
                        className='h-24 w-24'
                      />
                    </div>
                    <h3 className='mt-2 text-lg font-black text-white'>
                      {isFulfillmentSuccess ? 'Topup Berhasil' : 'Topup Gagal'}
                    </h3>
                  </div>

                  <div
                    className={`rounded-2xl border p-4 ${
                      isFulfillmentSuccess
                        ? 'border-emerald-400/15 bg-emerald-500/10'
                        : 'border-red-400/15 bg-red-500/10'
                    }`}
                  >
                    <div
                      className={`text-xs font-bold ${
                        isFulfillmentSuccess
                          ? 'text-emerald-300'
                          : 'text-red-300'
                      }`}
                    >
                      {isFulfillmentSuccess ? 'SN' : 'Reason'}
                    </div>
                    <div
                      className={`mt-2 break-words font-mono text-sm font-black leading-relaxed ${
                        isFulfillmentSuccess ? 'text-emerald-50' : 'text-red-50'
                      }`}
                    >
                      {providerResultValue || '-'}
                    </div>
                  </div>

                  <div className='space-y-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4'>
                    {[
                      ['Produk', resultInfo.productName],
                      ['Target', resultInfo.target],
                      [
                        'Harga Jual',
                        formatIDR(activePaymentOrder.amount || sellingPrice)
                      ],
                      ['Provider Ref', activePaymentOrder.provider_ref || '-']
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className='flex items-start justify-between gap-4 text-sm'
                      >
                        <span className='text-slate-500'>{label}</span>
                        <span className='min-w-0 break-all text-right font-mono font-bold text-slate-100'>
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className='grid grid-cols-2 gap-3'>
                    {providerResultValue && (
                      <button
                        type='button'
                        onClick={copyProviderResultValue}
                        className={`rounded-xl border py-3 text-xs font-black ${
                          isFulfillmentSuccess
                            ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25'
                            : 'border-red-400/30 bg-red-500/15 text-red-200 hover:bg-red-500/25'
                        }`}
                      >
                        {isFulfillmentSuccess ? 'Copy SN' : 'Copy Reason'}
                      </button>
                    )}

                    <button
                      type='button'
                      onClick={copyWhatsAppResult}
                      className={`rounded-xl border border-sky-400/30 bg-sky-500/15 py-3 text-xs font-black text-sky-200 hover:bg-sky-500/25 ${
                        providerResultValue ? '' : 'col-span-2'
                      }`}
                    >
                      Copy WA Text
                    </button>

                    <button
                      type='button'
                      onClick={handleModalNewOrder}
                      className='col-span-2 rounded-xl border border-white/[0.08] bg-white/[0.03] py-3 text-xs font-black text-slate-300 hover:bg-white/[0.06]'
                    >
                      New Order
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
