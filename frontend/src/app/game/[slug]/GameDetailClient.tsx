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
import ProductSelector, {
  type PurchaseProduct,
  type PurchaseProductSection
} from '@/components/game-purchase/ProductSelector'
import CyberneticGridShader from '@/components/ui/cybernetic-grid-shader'
import { findPublicCatalog, PublicCatalog } from '@/data/publicCatalogs'
import { getProductSellingPrice } from '@/lib/pricing'

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
  merchant_ref?: string
  reference?: string
  qr_url?: string
  checkout_url?: string
  amount?: number
}

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
).replace(/\/+$/, '')

const PURCHASES_ENABLED =
  process.env.NEXT_PUBLIC_PURCHASES_ENABLED === 'true'

const toPreviewCatalog = (catalog: PublicCatalog): Catalog => ({
  name: catalog.name,
  slug: catalog.slug,
  category: catalog.category,
  description: catalog.description,
  accent: catalog.accent,
  shortName: catalog.shortName,
  productSections: []
})

const normalizeProducts = (
  products: Product[] = [],
  checkIdCode?: string
) => {
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
        product.stock === undefined ||
        product.stock === -1 ||
        product.stock > 0

      return (
        product.is_active !== false &&
        product.admin_enabled !== false &&
        !isCheckerProduct &&
        hasStock
      )
    })
    .sort((a, b) => {
      const sortOrderDifference =
        (a.sort_order ?? 0) - (b.sort_order ?? 0)

      if (sortOrderDifference !== 0) {
        return sortOrderDifference
      }

      const priceDifference =
        getProductSellingPrice(a) - getProductSellingPrice(b)

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
      const sortOrderDifference =
        (a.sort_order ?? 0) - (b.sort_order ?? 0)

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
  paymentMethod: string
) => [
  ['Game', gameName],
  ['Produk', selectedProduct?.name || '-'],
  ['Target', selectedTarget || '-'],
  ['Pembayaran', paymentMethod]
]

export default function GameDetailClient ({ slug }: { slug: string }) {
  const router = useRouter()
  const publicCatalog = useMemo(() => findPublicCatalog(slug), [slug])
  const userIdRef = useRef<HTMLInputElement>(null)
  const zoneIdRef = useRef<HTMLInputElement>(null)

  const [game, setGame] = useState<Catalog | null>(
    !PURCHASES_ENABLED && publicCatalog ? toPreviewCatalog(publicCatalog) : null
  )
  const [loading, setLoading] = useState(PURCHASES_ENABLED)
  const [loadError, setLoadError] = useState('')

  const [userId, setUserId] = useState('')
  const [zoneId, setZoneId] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [accountWarning, setAccountWarning] = useState(false)
  const [paymentMethod] = useState('QRIS')
  const [isProcessing, setIsProcessing] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [transactionData, setTransactionData] = useState<CheckoutData | null>(
    null
  )

  useEffect(() => {
    setSelectedProduct(null)
    setAccountWarning(false)
    setShowModal(false)
    setTransactionData(null)
  }, [slug])

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
          description:
            data.description?.trim()
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
    userId.trim().length > 0 &&
    (!requiresZone || zoneId.trim().length > 0)
  const currentStep = selectedProduct ? 3 : hasAccountData ? 2 : 1

  useEffect(() => {
    if (hasAccountData) {
      setAccountWarning(false)
    }
  }, [hasAccountData])

  const totalLabel = selectedProduct
    ? formatIDR(getProductSellingPrice(selectedProduct))
    : 'Belum tersedia'
  const canCheckout =
    PURCHASES_ENABLED &&
    Boolean(selectedProduct) &&
    Boolean(userId) &&
    (!requiresZone || Boolean(zoneId))
  const disabledReason = !PURCHASES_ENABLED
    ? 'Katalog masih dapat dilihat dalam mode preview.'
    : !userId
    ? 'Masukkan User ID untuk melanjutkan.'
    : requiresZone && !zoneId
    ? 'Masukkan Zone ID untuk melanjutkan.'
    : !selectedProduct
    ? 'Pilih nominal untuk melanjutkan.'
    : ''

  const handleSelectProduct = (product: Product) => {
    if (!hasAccountData) {
      setAccountWarning(true)

      if (!userId.trim()) {
        userIdRef.current?.focus()
        userIdRef.current?.reportValidity()
        return
      }

      if (requiresZone && !zoneId.trim()) {
        zoneIdRef.current?.focus()
        zoneIdRef.current?.reportValidity()
        return
      }

      return
    }

    setAccountWarning(false)
    setSelectedProduct(product)
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
    try {
      const res = await fetch(`${API_BASE_URL}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: selectedProduct.ID,
          customer_phone: selectedTarget,
          payment_method: paymentMethod
        })
      })

      const result = await res.json()

      if (res.ok) {
        setTransactionData((result.data || result) as CheckoutData)
        setShowModal(true)
      } else {
        alert('Gagal: ' + (result.error || 'Checkout belum berhasil.'))
      }
    } catch {
      alert('Terjadi kesalahan sistem.')
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

      <main className='relative z-10 isolate min-h-screen overflow-x-clip bg-black pb-16 pt-28 sm:pb-20'>
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
            purchasesEnabled={PURCHASES_ENABLED}
            shortName={shortName}
            onBack={() => router.push('/#game')}
          />

        <div className='mt-4 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_370px]'>
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

              <div className='lg:sticky lg:top-[104px] lg:z-20'>
                <CheckoutStepper currentStep={currentStep} />
              </div>

              <AccountTargetFields
                requiresZone={requiresZone}
                userId={userId}
                zoneId={zoneId}
                userIdRef={userIdRef}
                zoneIdRef={zoneIdRef}
                onUserIdChange={setUserId}
                onZoneIdChange={setZoneId}
              />

              <ProductSelector
                sections={game.productSections}
                selectedProduct={selectedProduct}
                isAccountComplete={hasAccountData}
                accountWarning={accountWarning}
                requiresZone={requiresZone}
                formatPrice={formatIDR}
                onSelect={handleSelectProduct}
              />

              <section
                aria-labelledby='payment-method-title'
                className='rounded-[24px] border border-white/[0.08] bg-black/[0.035] p-5 shadow-[0_22px_70px_rgba(0,0,0,0.22)] backdrop-blur-md backdrop-saturate-150 sm:p-7'
              >
                <div>
                  <p className='font-mono text-[10px] uppercase tracking-[0.12em] text-white/[0.42]'>
                    Pembayaran
                  </p>
                  <h2
                    id='payment-method-title'
                    className='mt-2 text-2xl font-medium tracking-[-0.03em] text-white sm:text-[30px]'
                  >
                    Metode pembayaran
                  </h2>
                </div>

                <div className='mt-7 flex items-start justify-between gap-5 rounded-[18px] border border-white/[0.1] bg-white/[0.03] p-5'>
                  <div>
                    <p className='text-base font-medium text-white'>QRIS</p>
                    <p className='mt-2 max-w-lg text-sm leading-6 text-white/[0.48]'>
                      Bayar melalui aplikasi bank dan dompet digital yang
                      mendukung QRIS.
                    </p>
                  </div>
                  <span
                    aria-label='Metode pembayaran dipilih'
                    className='flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-fuchsia-300/70 bg-fuchsia-400 text-black'
                  >
                    <svg
                      viewBox='0 0 20 20'
                      fill='none'
                      className='h-3.5 w-3.5'
                      aria-hidden='true'
                    >
                      <path
                        d='m5 10 3.1 3.1L15 6.5'
                        stroke='currentColor'
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth='2'
                      />
                    </svg>
                  </span>
                </div>
              </section>

              <div className='lg:hidden'>
                <OrderSummary
                  canCheckout={canCheckout}
                  disabledReason={disabledReason}
                  isProcessing={isProcessing}
                  purchasesEnabled={PURCHASES_ENABLED}
                  rows={summaryRows(
                    game.name,
                    selectedProduct,
                    selectedTarget,
                    paymentMethod
                  )}
                  totalLabel={totalLabel}
                  onCheckout={handleCheckout}
                />
              </div>
            </div>

            <aside className='relative hidden lg:block lg:self-stretch'>
          <div className='custom-scrollbar lg:sticky lg:top-[104px] lg:max-h-[calc(100svh-120px)] lg:overflow-y-auto lg:overscroll-contain'>
                <OrderSummary
                  canCheckout={canCheckout}
                  disabledReason={disabledReason}
                  isProcessing={isProcessing}
                  purchasesEnabled={PURCHASES_ENABLED}
                  rows={summaryRows(
                    game.name,
                    selectedProduct,
                    selectedTarget,
                    paymentMethod
                  )}
                  totalLabel={totalLabel}
                  onCheckout={handleCheckout}
                />
              </div>
            </aside>
          </div>
        </div>
      </main>

      <SiteFooter />

      <PaymentModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        data={transactionData}
      />
    </div>
  )
}
