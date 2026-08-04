'use client'

import { useMemo } from 'react'

export interface PaymentMethodOption {
  quote_key: string
  code: string
  name: string
  category: string
  image_url?: string
  enabled: boolean
  disabled_reason?: string
  provider: 'midtrans' | string
  provider_method: string
  product_amount: number
  base_price: number
  service_fee: number
  customer_surcharge: number
  total_amount: number
  estimated_fee: number
  estimated_net_profit: number
  recommended: boolean
  recommendation_rank?: number
}

interface PaymentMethodSelectorProps {
  hasSelectedProduct: boolean
  loading: boolean
  error: string
  methods: PaymentMethodOption[]
  selectedQuoteKey: string
  onSelect: (quoteKey: string) => void
}

interface RecommendationOption {
  key: string
  method: PaymentMethodOption
  rank: number
}

const CATEGORY_LABELS: Record<string, string> = {
  QRIS: 'QRIS',
  E_WALLET: 'Dompet Digital',
  VIRTUAL_ACCOUNT: 'Virtual Account',
  E_BANKING: 'E-Banking',
  RETAIL: 'Gerai Retail',
  CREDIT_CARD: 'Kartu Kredit',
  PAYLATER: 'Paylater',
  OTHER: 'Lainnya'
}

const CATEGORY_ORDER = [
  'QRIS',
  'E_WALLET',
  'VIRTUAL_ACCOUNT',
  'E_BANKING',
  'RETAIL',
  'CREDIT_CARD',
  'PAYLATER',
  'OTHER'
]

const categoryLabel = (category: string) =>
  CATEGORY_LABELS[category] || category.replaceAll('_', ' ')

function SelectionMark ({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden='true'
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
        selected
          ? 'border-fuchsia-300/70 bg-fuchsia-400 text-black'
          : 'border-white/[0.16] bg-transparent text-transparent'
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
  )
}

function GenericQRISLogo () {
  return (
    <span className='flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] border border-white/[0.08] bg-white text-black'>
      <svg
        viewBox='0 0 24 24'
        fill='none'
        className='h-7 w-7'
        aria-hidden='true'
      >
        <path
          d='M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm11 0h2v2h-2v-2Zm3 0h2v6h-2v-6Zm-3 4h2v2h-2v-2Zm-3-6h2v2h-2v-2Zm0 3h2v5h-2v-5Z'
          fill='currentColor'
        />
      </svg>
    </span>
  )
}

function PaymentLogo ({
  imageUrl,
  code
}: {
  imageUrl?: string
  code: string
}) {
  if (!imageUrl) {
    return (
      <span className='flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] border border-white/[0.08] bg-white font-mono text-[10px] font-semibold text-black/[0.58]'>
        {code}
      </span>
    )
  }

  return (
    <span className='flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[13px] border border-white/[0.08] bg-white'>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt=''
        className='h-full w-full object-contain p-1.5'
      />
    </span>
  )
}

function RecommendationCard ({
  option,
  selectedQuoteKey,
  onSelect
}: {
  option: RecommendationOption
  selectedQuoteKey: string
  onSelect: (quoteKey: string) => void
}) {
  const { method } = option
  const selected = selectedQuoteKey === method.quote_key

  return (
    <button
      type='button'
      aria-pressed={selected}
      onClick={() => onSelect(method.quote_key)}
      className={`group flex min-h-[96px] items-center gap-3 rounded-[18px] border p-4 text-left outline-none transition-[border-color,background-color,box-shadow] duration-300 focus-visible:ring-2 focus-visible:ring-fuchsia-400/70 ${
        selected
          ? 'border-fuchsia-300/55 bg-fuchsia-400/[0.075] shadow-[0_16px_42px_rgba(217,70,239,0.1)]'
          : 'border-white/[0.08] bg-white/[0.025] hover:border-white/[0.16] hover:bg-white/[0.045]'
      }`}
    >
      {method.category === 'QRIS' ? (
        <GenericQRISLogo />
      ) : (
        <PaymentLogo imageUrl={method.image_url} code={method.code} />
      )}

      <span className='min-w-0 flex-1'>
        <span className='block truncate text-sm font-semibold text-white'>
          {method.name}
        </span>
        <span className='mt-1.5 block font-mono text-[8px] uppercase tracking-[0.1em] text-emerald-300/[0.64]'>
          {option.rank === 1 ? 'Paling praktis' : 'Alternatif cepat'}
        </span>
        <span className='mt-1.5 block text-xs font-medium tabular-nums text-white/[0.72]'>
          Total Rp{method.total_amount.toLocaleString('id-ID')}
        </span>
      </span>

      <SelectionMark selected={selected} />
    </button>
  )
}

function PaymentMethodCard ({
  method,
  selected,
  onSelect
}: {
  method: PaymentMethodOption
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type='button'
      aria-pressed={selected}
      disabled={!method.enabled}
      onClick={onSelect}
      className={`group flex min-h-[88px] items-center gap-3 rounded-[18px] border p-4 text-left outline-none transition-[border-color,background-color,box-shadow] duration-300 focus-visible:ring-2 focus-visible:ring-fuchsia-400/70 ${
        !method.enabled
          ? 'cursor-not-allowed border-white/[0.055] bg-white/[0.018] opacity-55'
          : selected
          ? 'border-fuchsia-300/55 bg-fuchsia-400/[0.075] shadow-[0_16px_42px_rgba(217,70,239,0.1)]'
          : 'border-white/[0.08] bg-white/[0.025] hover:border-white/[0.16] hover:bg-white/[0.045]'
      }`}
    >
      {method.category === 'QRIS' ? (
        <GenericQRISLogo />
      ) : (
        <PaymentLogo imageUrl={method.image_url} code={method.code} />
      )}

      <span className='min-w-0 flex-1'>
        <span className='block truncate text-sm font-medium text-white'>
          {method.name}
        </span>
        <span className='mt-1.5 block text-[10px] leading-4 text-white/[0.4]'>
          {method.enabled
            ? `Total ${method.total_amount.toLocaleString('id-ID')}`
            : method.disabled_reason || 'Metode tidak tersedia.'}
        </span>
      </span>

      <SelectionMark selected={selected} />
    </button>
  )
}

export default function PaymentMethodSelector ({
  hasSelectedProduct,
  loading,
  error,
  methods,
  selectedQuoteKey,
  onSelect
}: PaymentMethodSelectorProps) {
  const availableMethods = useMemo(
    () => methods.filter(method => method.enabled),
    [methods]
  )

  const recommendations = useMemo(() => {
    const rankedMethods = availableMethods
      .filter(method => (method.recommendation_rank || 0) > 0)
      .sort(
        (first, second) =>
          (first.recommendation_rank || 0) -
          (second.recommendation_rank || 0)
      )

    const sourceMethods =
      rankedMethods.length > 0
        ? rankedMethods
        : availableMethods.filter(method => method.recommended)

    return sourceMethods.slice(0, 2).map((method, index) => ({
      key: method.quote_key,
      method,
      rank: method.recommendation_rank || index + 1
    }))
  }, [availableMethods])

  const recommendedQuoteKeys = useMemo(
    () => new Set(recommendations.map(option => option.method.quote_key)),
    [recommendations]
  )

  const groups = useMemo(() => {
    const categoryMap = new Map<string, PaymentMethodOption[]>()

    methods.forEach(method => {
      if (recommendedQuoteKeys.has(method.quote_key)) return

      const category = method.category || 'OTHER'
      const currentMethods = categoryMap.get(category) || []
      currentMethods.push(method)
      categoryMap.set(category, currentMethods)
    })

    return [...categoryMap.entries()]
      .sort(([firstCategory], [secondCategory]) => {
        const firstIndex = CATEGORY_ORDER.indexOf(firstCategory)
        const secondIndex = CATEGORY_ORDER.indexOf(secondCategory)
        const safeFirstIndex =
          firstIndex === -1 ? CATEGORY_ORDER.length : firstIndex
        const safeSecondIndex =
          secondIndex === -1 ? CATEGORY_ORDER.length : secondIndex

        return safeFirstIndex - safeSecondIndex
      })
      .map(([category, categoryMethods]) => ({
        category,
        title: categoryLabel(category),
        methods: categoryMethods
      }))
  }, [methods, recommendedQuoteKeys])

  return (
    <section
      aria-labelledby='payment-method-title'
      className='aj-public-glass relative rounded-[24px] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.3)] sm:p-7'
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
        <p className='mt-3 max-w-2xl text-sm leading-6 text-white/[0.46]'>
          Pilih metode pembayaran yang tersedia untuk nominal ini.
        </p>
      </div>

      {!hasSelectedProduct && (
        <div className='mt-7 rounded-[18px] border border-dashed border-white/[0.1] bg-white/[0.02] p-5 text-sm leading-6 text-white/[0.42]'>
          Pilih nominal produk terlebih dahulu.
        </div>
      )}

      {hasSelectedProduct && loading && (
        <div className='mt-7 space-y-8'>
          {[0, 1, 2].map(section => (
            <div key={section}>
              <div className='h-5 w-32 animate-pulse rounded bg-white/[0.04] [animation-duration:1.8s]' />
              <div className='mt-4 grid gap-3 sm:grid-cols-2'>
                {[0, 1].map(item => (
                  <div
                    key={item}
                    className='h-[88px] animate-pulse rounded-[18px] border border-white/[0.06] bg-white/[0.025] [animation-duration:1.8s]'
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {hasSelectedProduct && !loading && error && (
        <div
          role='status'
          className='mt-7 rounded-[18px] border border-amber-300/20 bg-amber-300/[0.055] p-5'
        >
          <p className='text-sm font-medium text-amber-100'>
            Metode pembayaran belum tersedia
          </p>
          <p className='mt-2 text-sm leading-6 text-white/[0.5]'>{error}</p>
        </div>
      )}

      {hasSelectedProduct &&
        !loading &&
        methods.length > 0 && (
          <div className='mt-8'>
            {recommendations.length > 0 && (
              <section aria-labelledby='recommended-payment-heading'>
                <h3
                  id='recommended-payment-heading'
                  className='text-base font-medium tracking-[-0.02em] text-white/[0.9] sm:text-lg'
                >
                  Rekomendasi
                </h3>

                <div className='mt-4 grid gap-3 sm:grid-cols-2'>
                  {recommendations.map(option => (
                    <RecommendationCard
                      key={option.key}
                      option={option}
                      selectedQuoteKey={selectedQuoteKey}
                      onSelect={onSelect}
                    />
                  ))}
                </div>
              </section>
            )}

            {groups.map(group => (
              <section
                key={group.category}
                aria-labelledby={`payment-heading-${group.category}`}
                className='mt-9 border-t border-white/[0.08] pt-9'
              >
                <div className='flex items-end justify-between gap-4'>
                  <h3
                    id={`payment-heading-${group.category}`}
                    className='text-base font-medium tracking-[-0.02em] text-white/[0.9] sm:text-lg'
                  >
                    {group.title}
                  </h3>
                  <span className='shrink-0 font-mono text-[9px] uppercase tracking-[0.08em] text-white/[0.34]'>
                    {group.methods.length} metode
                  </span>
                </div>

                <div className='mt-4 grid gap-3 sm:grid-cols-2'>
                  {group.methods.map(method => (
                    <PaymentMethodCard
                      key={method.quote_key}
                      method={method}
                      selected={selectedQuoteKey === method.quote_key}
                      onSelect={() => onSelect(method.quote_key)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
    </section>
  )
}
