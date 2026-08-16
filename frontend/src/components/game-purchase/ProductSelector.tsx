'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { getProductStartingPrice } from '@/lib/pricing'

export interface PurchaseProduct {
  ID: number
  name: string
  code: string
  price?: number
  selling_price?: number
  starting_price?: number
  starting_payment_method?: string
  original_price?: number | null
  stock?: number
  is_active?: boolean
  admin_enabled?: boolean
  image_url?: string
  product_group_id?: number | null
  sort_order?: number
}

export interface PurchaseProductSection {
  key: string
  title: string
  products: PurchaseProduct[]
}

interface ProductSelectorProps {
  sections: PurchaseProductSection[]
  selectedProduct: PurchaseProduct | null
  isAccountComplete: boolean
  accountWarning: boolean
  targetType?: string
  formatPrice: (value?: number) => string
  onSelect: (product: PurchaseProduct) => void
}

function ProductThumbnail ({
  imageUrl,
  code,
  canAnimate
}: {
  imageUrl?: string
  code: string
  canAnimate: boolean
}) {
  const normalizedImageUrl = imageUrl?.trim() || ''
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null)
  const hasImageError = failedImageUrl === normalizedImageUrl

  if (!normalizedImageUrl || hasImageError) {
    return (
      <span className='inline-flex min-h-8 max-w-[92px] items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] px-2.5 font-mono text-[8px] uppercase tracking-[0.1em] text-white/[0.38]'>
        {code.trim().slice(0, 8) || 'ITEM'}
      </span>
    )
  }

  return (
    // Static export memakai URL aset langsung; fallback ditangani lewat onError.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={normalizedImageUrl}
      alt=''
      aria-hidden='true'
      loading='lazy'
      decoding='async'
      onError={() => setFailedImageUrl(normalizedImageUrl)}
      className={`h-[72px] w-[72px] object-contain transition-transform duration-500 ease-out ${
        canAnimate ? 'group-hover:scale-[1.04]' : ''
      }`}
    />
  )
}

function ProductOption ({
  product,
  selectedProduct,
  isAccountComplete,
  showAccountWarning,
  formatPrice,
  onSelect
}: {
  product: PurchaseProduct
  selectedProduct: PurchaseProduct | null
  isAccountComplete: boolean
  showAccountWarning: boolean
  formatPrice: (value?: number) => string
  onSelect: (product: PurchaseProduct) => void
}) {
  const isSelected = selectedProduct?.ID === product.ID
  const finalPrice = getProductStartingPrice(product)
  const originalPrice = product.original_price ?? 0
  const hasValidDiscountAmounts =
    Number.isFinite(finalPrice) &&
    Number.isFinite(originalPrice) &&
    finalPrice >= 0 &&
    originalPrice > finalPrice
  const discountPercent = hasValidDiscountAmounts
    ? Math.round(((originalPrice - finalPrice) / originalPrice) * 100)
    : 0
  const hasDiscount = discountPercent > 0
  const productName = product.name.trim()
  const productNameTypography =
    productName.length > 64
      ? 'text-[11px] leading-4'
      : productName.length > 44
      ? 'text-xs leading-4'
      : 'text-[13px] leading-4'

  return (
    <button
      type='button'
      aria-pressed={isSelected}
      aria-disabled={!isAccountComplete}
      aria-describedby={
        showAccountWarning ? 'account-completion-warning' : undefined
      }
      onClick={() => onSelect(product)}
      className={`group relative flex h-full min-h-[210px] flex-col overflow-hidden rounded-[18px] border p-3.5 text-center outline-none transition-[border-color,background-color,box-shadow,opacity,filter] duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
        !isAccountComplete
          ? 'cursor-not-allowed border-white/[0.08] bg-white/[0.025] opacity-45 saturate-50'
          : isSelected
          ? 'border-fuchsia-400/55 bg-fuchsia-400/[0.075] shadow-[0_18px_50px_rgba(217,70,239,0.1)]'
          : 'cursor-pointer border-white/[0.08] bg-white/[0.025] hover:border-white/[0.16] hover:bg-white/[0.045]'
      }`}
    >
      <span
        aria-hidden='true'
        className={`absolute right-3.5 top-3.5 flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${
          isSelected
            ? 'border-fuchsia-300/70 bg-fuchsia-400 text-black'
            : 'border-white/[0.14] bg-transparent text-transparent group-hover:border-white/[0.26]'
        }`}
      >
        <svg viewBox='0 0 20 20' fill='none' className='h-3 w-3'>
          <path
            d='m5 10 3.1 3.1L15 6.5'
            stroke='currentColor'
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth='2'
          />
        </svg>
      </span>

      <div className='flex h-[86px] items-center justify-center'>
        <ProductThumbnail
          imageUrl={product.image_url}
          code={product.code}
          canAnimate={isAccountComplete}
        />
      </div>

      <p
        title={productName}
        className={`mt-2.5 min-h-[48px] font-medium text-white [overflow-wrap:anywhere] ${productNameTypography}`}
      >
        {productName}
      </p>

      <div className='mt-3.5 flex min-h-[52px] flex-col items-center'>
        <p className='tabular-nums text-base font-semibold tracking-[-0.02em] text-[var(--aj-accent)]'>
          {formatPrice(finalPrice)}
        </p>

        {hasDiscount && (
          <div className='mt-2 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1'>
            <span className='whitespace-nowrap tabular-nums text-[11px] leading-none text-white/[0.34] line-through'>
              {formatPrice(originalPrice)}
            </span>

            <span className='whitespace-nowrap rounded-full border border-fuchsia-300/25 bg-fuchsia-400/[0.1] px-1.5 py-0.5 text-[9px] font-medium leading-4 text-fuchsia-200'>
              -{discountPercent}%
            </span>
          </div>
        )}
      </div>
    </button>
  )
}

export default function ProductSelector ({
  sections,
  selectedProduct,
  isAccountComplete,
  accountWarning,
  targetType = 'SINGLE_ID',
  formatPrice,
  onSelect
}: ProductSelectorProps) {
  const visibleSections = useMemo(
    () => sections.filter(section => section.products.length > 0),
    [sections]
  )
  const selectedSectionKey = visibleSections.find(section =>
    section.products.some(product => product.ID === selectedProduct?.ID)
  )?.key
  const [activeSectionKey, setActiveSectionKey] = useState(
    selectedSectionKey ?? visibleSections[0]?.key ?? ''
  )
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})
  const tabListRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<Record<string, HTMLAnchorElement | null>>({})
  const resolvedActiveSectionKey = visibleSections.some(
    section => section.key === activeSectionKey
  )
    ? activeSectionKey
    : selectedSectionKey ?? visibleSections[0]?.key ?? ''
  const showAccountWarning = accountWarning && !isAccountComplete

  useEffect(() => {
    const observedEntries = new Map<string, IntersectionObserverEntry>()
    const observedElements = visibleSections
      .map(section => sectionRefs.current[section.key])
      .filter((element): element is HTMLElement => element !== null)

    if (observedElements.length === 0) return

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          const sectionKey = (entry.target as HTMLElement).dataset
            .productSection

          if (!sectionKey) return

          if (entry.isIntersecting) {
            observedEntries.set(sectionKey, entry)
          } else {
            observedEntries.delete(sectionKey)
          }
        })

        const stickyOffset = window.matchMedia('(min-width: 1024px)').matches
          ? 252
          : 168
        const nearestSection = Array.from(observedEntries.entries()).sort(
          ([, firstEntry], [, secondEntry]) =>
            Math.abs(firstEntry.boundingClientRect.top - stickyOffset) -
            Math.abs(secondEntry.boundingClientRect.top - stickyOffset)
        )[0]

        if (nearestSection) {
          setActiveSectionKey(nearestSection[0])
        }
      },
      {
        rootMargin: `${
          window.matchMedia('(min-width: 1024px)').matches ? -252 : -168
        }px 0px -55% 0px`,
        threshold: [0, 0.01, 0.25]
      }
    )

    observedElements.forEach(element => observer.observe(element))

    return () => observer.disconnect()
  }, [visibleSections])

  useEffect(() => {
    const tabList = tabListRef.current
    const activeTab = tabRefs.current[resolvedActiveSectionKey]

    if (!tabList || !activeTab) return

    const tabListBounds = tabList.getBoundingClientRect()
    const activeTabBounds = activeTab.getBoundingClientRect()
    const centeredScrollLeft =
      tabList.scrollLeft +
      activeTabBounds.left -
      tabListBounds.left -
      (tabListBounds.width - activeTabBounds.width) / 2

    tabList.scrollTo({
      left: Math.max(0, centeredScrollLeft),
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth'
    })
  }, [resolvedActiveSectionKey])

  const scrollToSection = (sectionKey: string) => {
    setActiveSectionKey(sectionKey)
    sectionRefs.current[sectionKey]?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    })
  }

  return (
    <section
      id='catalog'
      aria-labelledby='product-selector-title'
      className='aj-public-glass relative rounded-[24px] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.3)] outline-none focus:outline-none focus-visible:outline-none sm:p-7'
    >
      <div>
        <p className='font-mono text-[10px] uppercase tracking-[0.12em] text-white/[0.42]'>
          Produk
        </p>
        <h2
          id='product-selector-title'
          className='mt-2 text-2xl font-medium tracking-[-0.03em] text-white sm:text-[28px]'
        >
          Pilih nominal
        </h2>
        {showAccountWarning && (
          <p
            id='account-completion-warning'
            role='alert'
            className='mt-2 text-xs leading-5 text-fuchsia-200/[0.72]'
          >
            {(targetType === 'DUAL_INPUT' || targetType === 'SERVER_DROPDOWN')
              ? 'Lengkapi User ID dan Zone/Server ID pada bagian Data akun di atas.'
              : 'Lengkapi User ID pada bagian Data akun di atas.'}
          </p>
        )}
      </div>

      {visibleSections.length === 0 ? (
        <div className='mt-7 rounded-2xl border border-dashed border-white/[0.1] bg-white/[0.02] px-5 py-9 text-center text-sm text-white/[0.48]'>
          Nominal belum tersedia.
        </div>
      ) : (
        <div>
          {visibleSections.length > 1 && (
            <nav
              aria-label='Navigasi kelompok produk'
              className='sticky top-[92px] z-20 -mx-2 mt-5 rounded-[22px] border border-white/[0.08] bg-black/[0.035] px-2 py-2.5 shadow-[0_18px_55px_rgba(0,0,0,0.18)] backdrop-blur-md backdrop-saturate-150 sm:top-[96px] lg:top-[180px]'
            >
              <div
                ref={tabListRef}
                className='flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
              >
                {visibleSections.map(section => {
                  const isActive = section.key === resolvedActiveSectionKey
                  const sectionId = `product-section-${section.key}`

                  return (
                    <a
                      key={section.key}
                      ref={element => {
                        tabRefs.current[section.key] = element
                      }}
                      href={`#${sectionId}`}
                      aria-current={isActive ? 'location' : undefined}
                      onClick={event => {
                        event.preventDefault()
                        scrollToSection(section.key)
                      }}
                      className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-[border-color,background-color,color,box-shadow] duration-300 focus-visible:outline-none ${
                        isActive
                          ? 'border-fuchsia-300/45 bg-fuchsia-400/[0.08] text-fuchsia-100 shadow-[0_8px_24px_rgba(217,70,239,0.12)]'
                          : 'border-white/[0.08] bg-white/[0.025] text-white/[0.52] hover:border-white/[0.16] hover:bg-white/[0.05] hover:text-white/[0.8]'
                      }`}
                    >
                      {section.title}
                    </a>
                  )
                })}
              </div>
            </nav>
          )}

          <div className={visibleSections.length > 1 ? 'mt-6' : 'mt-2'}>
            {visibleSections.map((section, index) => {
              const headingId = `product-heading-${section.key}`

              return (
                <section
                  key={section.key}
                  id={`product-section-${section.key}`}
                  ref={element => {
                    sectionRefs.current[section.key] = element
                  }}
                  data-product-section={section.key}
                  aria-labelledby={headingId}
                  className={`scroll-mt-[168px] lg:scroll-mt-[252px] ${
                    index > 0 ? 'mt-10 border-t border-white/[0.08] pt-10' : ''
                  }`}
                >
                  <div className='flex items-end justify-between gap-4'>
                    <h3
                      id={headingId}
                      className='text-base font-medium tracking-[-0.02em] text-white/[0.9] sm:text-lg'
                    >
                      {section.title}
                    </h3>

                    <span className='shrink-0 rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1 font-mono text-[9px] uppercase tracking-[0.08em] text-white/[0.42]'>
                      {section.products.length} Items
                    </span>
                  </div>

                  <div className='mt-4 grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
                    {section.products.map(product => (
                      <ProductOption
                        key={product.ID}
                        product={product}
                        selectedProduct={selectedProduct}
                        isAccountComplete={isAccountComplete}
                        showAccountWarning={showAccountWarning}
                        formatPrice={formatPrice}
                        onSelect={onSelect}
                      />
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
