'use client'

interface OrderSummaryProps {
  canCheckout: boolean
  disabledReason: string
  isProcessing: boolean
  purchasesEnabled: boolean
  rows: string[][]
  productAmountLabel: string
  paymentMethodLabel: string
  quantity?: number
  customerSurchargeLabel: string
  hasCustomerSurcharge: boolean
  contactInfo?: string
  appliedPromoCode?: string
  totalLabel: string
  onCheckout: () => void
}

export default function OrderSummary ({
  canCheckout,
  disabledReason,
  isProcessing,
  purchasesEnabled,
  rows,
  productAmountLabel,
  quantity = 1,
  paymentMethodLabel,
  customerSurchargeLabel,
  hasCustomerSurcharge,
  contactInfo,
  appliedPromoCode,
  totalLabel,
  onCheckout
}: OrderSummaryProps) {
  const hasAdditionalInfo = Boolean(contactInfo || appliedPromoCode)

  return (
    <section
      aria-labelledby='order-summary-title'
      className='rounded-[24px] border border-white/[0.08] bg-black/[0.035] p-5 shadow-[0_22px_70px_rgba(0,0,0,0.22)] backdrop-blur-md backdrop-saturate-150 sm:p-6'
    >
      <div>
        <p className='font-mono text-[10px] uppercase tracking-[0.12em] text-white/[0.42]'>
          Ringkasan
        </p>
        <h2
          id='order-summary-title'
          className='mt-2 text-2xl font-medium tracking-[-0.03em] text-white sm:text-[28px]'
        >
          Pesanan
        </h2>
      </div>

      {/* KELOMPOK 1: DETAIL PESANAN (Target disesuaikan jadi 'Detail Akun') */}
      <dl className='mt-7 space-y-4'>
        {rows.map(([label, value]) => {
          const displayLabel = label === 'Target' ? 'Detail Akun' : label
          return (
            <div
              key={label}
              className='grid grid-cols-[96px_minmax(0,1fr)] gap-4 border-t border-white/[0.08] pt-4'
            >
              <dt className='text-xs text-white/[0.4]'>{displayLabel}</dt>
              <dd className='break-words text-right text-sm text-white/[0.88]'>
                {value}
              </dd>
            </div>
          )
        })}
      </dl>

      {/* KELOMPOK 2: DETAIL PEMBAYARAN */}
      <dl className='mt-5 space-y-3 border-t border-white/[0.1] pt-5'>
        <div className='flex items-center justify-between gap-4 text-sm'>
          <dt className='text-white/[0.44]'>Harga produk</dt>
          <dd className='text-right text-white/[0.88]'>{productAmountLabel}</dd>
        </div>

        {/* Jumlah hanya tampil jika quantity > 1 */}
        {quantity > 1 && (
          <div className='flex items-center justify-between gap-4 text-sm'>
            <dt className='text-white/[0.44]'>Jumlah</dt>
            <dd className='text-right font-mono text-sm font-semibold text-white'>
              {quantity}x
            </dd>
          </div>
        )}

        <div className='flex items-center justify-between gap-4 text-sm'>
          <dt className='text-white/[0.44]'>Pembayaran</dt>
          <dd className='text-right text-white/[0.88]'>{paymentMethodLabel}</dd>
        </div>

        <div className='flex items-center justify-between gap-4 text-sm'>
          <dt className='text-white/[0.44]'>Biaya metode</dt>
          <dd
            className={`text-right text-sm ${
              hasCustomerSurcharge
                ? 'font-medium text-amber-200/[0.82]'
                : 'font-medium text-emerald-300/[0.82]'
            }`}
          >
            {hasCustomerSurcharge ? customerSurchargeLabel : 'Rp 0'}
          </dd>
        </div>
      </dl>

      {/* KELOMPOK 3: INFORMASI TAMBAHAN (Hanya Tampil Jika Kontak / Promo Diisi) */}
      {hasAdditionalInfo && (
        <div className='mt-6 border-t border-white/[0.08] pt-5'>
          <dl className='space-y-3'>
            {contactInfo && (
              <div className='flex items-center justify-between gap-4 text-sm'>
                <dt className='text-xs text-white/[0.44]'>Kontak</dt>
                <dd className='break-all text-right text-sm font-medium text-white/[0.88]'>
                  {contactInfo}
                </dd>
              </div>
            )}

            {appliedPromoCode && (
              <div className='flex items-center justify-between gap-4 text-sm'>
                <dt className='text-xs text-white/[0.44]'>Kode promo</dt>
                <dd className='text-right font-mono text-sm font-semibold text-fuchsia-300'>
                  {appliedPromoCode}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {/* TOTAL AKHIR (CYAN) */}
      <div className='mt-5 flex items-end justify-between gap-4 border-t border-white/[0.1] pt-4'>
        <dt className='font-medium text-sm uppercase tracking-[0.1em] text-white'>
          Total
        </dt>
        <dd className='break-words text-right text-2xl font-bold tracking-[-0.035em] text-cyan-400'>
          {totalLabel}
        </dd>
      </div>

      <button
        type='button'
        onClick={onCheckout}
        disabled={!canCheckout || isProcessing}
        className={`mt-7 min-h-12 w-full rounded-full border px-5 text-sm font-semibold outline-none transition-[border-color,background-color,color,box-shadow] duration-300 focus-visible:ring-2 focus-visible:ring-fuchsia-400/70 ${
          !canCheckout || isProcessing
            ? 'cursor-not-allowed border-white/[0.06] bg-white/[0.045] text-white/[0.34]'
            : 'border-white bg-white text-black hover:border-fuchsia-300 hover:bg-fuchsia-300 hover:shadow-[0_12px_34px_rgba(217,70,239,0.18)]'
        }`}
      >
        {!purchasesEnabled
          ? 'Pembelian Sedang Ditutup'
          : isProcessing
          ? 'Memproses...'
          : 'Beli Sekarang'}
      </button>

      {disabledReason && !isProcessing && (
        <p className='mt-3 text-center text-xs leading-5 text-white/[0.38]'>
          {disabledReason}
        </p>
      )}
    </section>
  )
}
