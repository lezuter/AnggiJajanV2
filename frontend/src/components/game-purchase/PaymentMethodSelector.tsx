'use client'

export interface PaymentMethodOption {
  code: string
  name: string
  category: string
  image_url?: string
  service_fee: number
  total_amount: number
  enabled: boolean
  recommended: boolean
  disabled_reason?: string
}

interface PaymentMethodSelectorProps {
  hasSelectedProduct: boolean
  loading: boolean
  error: string
  methods: PaymentMethodOption[]
  selectedCode: string
  onSelect: (code: string) => void
}

const CATEGORY_LABELS: Record<string, string> = {
  QRIS: 'QRIS',
  VIRTUAL_ACCOUNT: 'Virtual account',
  E_WALLET: 'Dompet digital',
  RETAIL: 'Gerai retail',
  E_BANKING: 'E-banking',
  CREDIT_CARD: 'Kartu kredit',
  PAYLATER: 'Paylater'
}

export default function PaymentMethodSelector ({
  hasSelectedProduct,
  loading,
  error,
  methods,
  selectedCode,
  onSelect
}: PaymentMethodSelectorProps) {
  const availableMethods = methods.filter(method => method.enabled)

  return (
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
        <p className='mt-3 text-sm leading-6 text-white/[0.46]'>
          Metode yang tampil sudah disaring otomatis berdasarkan nominal dan
          margin transaksi.
        </p>
      </div>

      {!hasSelectedProduct && (
        <div className='mt-7 rounded-[18px] border border-dashed border-white/[0.1] bg-white/[0.02] p-5 text-sm leading-6 text-white/[0.42]'>
          Pilih nominal produk terlebih dahulu.
        </div>
      )}

      {hasSelectedProduct && loading && (
        <div className='mt-7 grid gap-3 sm:grid-cols-2'>
          {[0, 1, 2, 3].map(item => (
            <div
              key={item}
              className='h-[92px] animate-pulse rounded-[18px] border border-white/[0.06] bg-white/[0.025] [animation-duration:1.8s]'
            />
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
        !error &&
        availableMethods.length > 0 && (
          <div className='mt-7 grid gap-3 sm:grid-cols-2'>
            {availableMethods.map(method => {
              const selected = method.code === selectedCode
              const categoryLabel =
                CATEGORY_LABELS[method.category] || method.category

              return (
                <button
                  key={method.code}
                  type='button'
                  aria-pressed={selected}
                  onClick={() => onSelect(method.code)}
                  className={`group relative min-h-[92px] rounded-[18px] border p-4 text-left outline-none transition-[border-color,background-color,box-shadow,transform] duration-300 focus-visible:ring-2 focus-visible:ring-fuchsia-400/70 ${
                    selected
                      ? 'border-fuchsia-300/60 bg-fuchsia-400/[0.1] shadow-[0_14px_38px_rgba(217,70,239,0.1)]'
                      : 'border-white/[0.09] bg-white/[0.025] hover:-translate-y-0.5 hover:border-white/[0.18] hover:bg-white/[0.045]'
                  }`}
                >
                  <div className='flex items-start justify-between gap-3'>
                    <div className='min-w-0'>
                      <p className='truncate text-sm font-medium text-white'>
                        {method.name}
                      </p>
                      <p className='mt-2 font-mono text-[9px] uppercase tracking-[0.1em] text-white/[0.38]'>
                        {categoryLabel}
                      </p>
                    </div>

                    <span
                      aria-hidden='true'
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                        selected
                          ? 'border-fuchsia-300/70 bg-fuchsia-400 text-black'
                          : 'border-white/[0.16] bg-white/[0.025] text-transparent'
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
                  </div>

                  {method.recommended && (
                    <span className='mt-3 inline-flex rounded-full border border-emerald-300/20 bg-emerald-300/[0.07] px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.1em] text-emerald-200'>
                      Rekomendasi
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
    </section>
  )
}