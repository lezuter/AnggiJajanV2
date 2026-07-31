'use client'

import { useState } from 'react'
import { getProductSellingPrice } from '@/lib/pricing'

export interface PurchaseProduct {
  ID: number
  name: string
  code: string
  price?: number
  selling_price?: number
  original_price?: number | null
  stock?: number
  is_active?: boolean
  admin_enabled?: boolean
  image_url?: string
}

interface ProductSelectorProps {
  products: PurchaseProduct[]
  selectedProduct: PurchaseProduct | null
  isAccountComplete: boolean
  accountWarning: boolean
  requiresZone: boolean
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
      <span className='inline-flex min-h-9 max-w-[104px] items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 font-mono text-[9px] uppercase tracking-[0.1em] text-white/[0.38]'>
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
      className={`h-[88px] w-[88px] object-contain transition-transform duration-500 ease-out ${
        canAnimate ? 'group-hover:scale-[1.04]' : ''
      }`}
    />
  )
}

export default function ProductSelector ({
  products,
  selectedProduct,
  isAccountComplete,
  accountWarning,
  requiresZone,
  formatPrice,
  onSelect
}: ProductSelectorProps) {
  return (
    <section
      id='catalog'
      aria-labelledby='product-selector-title'
      className='rounded-[24px] border border-white/[0.08] bg-black/[0.035] p-5 shadow-[0_22px_70px_rgba(0,0,0,0.22)] backdrop-blur-md backdrop-saturate-150 sm:p-7'
    >
      <div>
        <p className='font-mono text-[10px] uppercase tracking-[0.12em] text-white/[0.42]'>
          Produk
        </p>
        <h2
          id='product-selector-title'
          className='mt-2 text-2xl font-medium tracking-[-0.03em] text-white sm:text-[30px]'
        >
          Pilih nominal
        </h2>
        {accountWarning && !isAccountComplete && (
          <p
            id='account-completion-warning'
            role='alert'
            className='mt-2 text-xs leading-5 text-fuchsia-200/[0.72]'
          >
            {requiresZone
              ? 'Lengkapi User ID dan Zone ID terlebih dahulu untuk memilih nominal.'
              : 'Lengkapi User ID terlebih dahulu untuk memilih nominal.'}
          </p>
        )}
      </div>

      {products.length === 0 ? (
        <div className='mt-7 rounded-2xl border border-dashed border-white/[0.1] bg-white/[0.02] px-5 py-9 text-center text-sm text-white/[0.48]'>
          Nominal belum tersedia.
        </div>
      ) : (
        <div className='mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-3'>
          {products.map(product => {
            const isSelected = selectedProduct?.ID === product.ID
            const finalPrice = getProductSellingPrice(product)
            const originalPrice = product.original_price ?? 0
            const hasDiscount =
              finalPrice > 0 && originalPrice > finalPrice
            const discountPercent = hasDiscount
              ? Math.round(
                  ((originalPrice - finalPrice) / originalPrice) * 100
                )
              : 0

            return (
              <button
                key={product.ID}
                type='button'
                aria-pressed={isSelected}
                aria-disabled={!isAccountComplete}
                aria-describedby={
                  accountWarning && !isAccountComplete
                    ? 'account-completion-warning'
                    : undefined
                }
                onClick={() => onSelect(product)}
                className={`group relative min-h-[230px] overflow-hidden rounded-[18px] border p-4 text-center outline-none transition-[border-color,background-color,box-shadow,opacity,filter] duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:ring-2 focus-visible:ring-fuchsia-400/70 ${
                  !isAccountComplete
                    ? 'cursor-not-allowed border-white/[0.08] bg-white/[0.025] opacity-45 saturate-50'
                    : isSelected
                    ? 'border-fuchsia-400/55 bg-fuchsia-400/[0.075] shadow-[0_18px_50px_rgba(217,70,239,0.1)]'
                    : 'cursor-pointer border-white/[0.08] bg-white/[0.025] hover:border-white/[0.16] hover:bg-white/[0.045]'
                }`}
              >
                <span
                  aria-hidden='true'
                  className={`absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${
                    isSelected
                      ? 'border-fuchsia-300/70 bg-fuchsia-400 text-black'
                      : 'border-white/[0.14] bg-transparent text-transparent group-hover:border-white/[0.26]'
                  }`}
                >
                  <svg
                    viewBox='0 0 20 20'
                    fill='none'
                    className='h-3 w-3'
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

                <div className='flex h-[104px] items-center justify-center'>
                  <ProductThumbnail
                    imageUrl={product.image_url}
                    code={product.code}
                    canAnimate={isAccountComplete}
                  />
                </div>

                <p className='mt-3 line-clamp-2 min-h-10 text-sm font-medium leading-5 text-white sm:text-[15px]'>
                  {product.name}
                </p>

                <div className='mt-3'>
                  <p className='text-base font-semibold text-white'>
                    {formatPrice(finalPrice)}
                  </p>

                  <div className='mt-1.5 flex min-h-5 items-center justify-center gap-2'>
                    {hasDiscount && (
                      <>
                        <span className='text-xs text-white/[0.38] line-through'>
                          {formatPrice(originalPrice)}
                        </span>
                        <span className='rounded-full border border-fuchsia-300/25 bg-fuchsia-400/[0.1] px-2 py-0.5 text-[10px] font-medium text-fuchsia-200'>
                          -{discountPercent}%
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
