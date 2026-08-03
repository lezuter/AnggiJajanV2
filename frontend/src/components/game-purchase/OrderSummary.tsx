'use client'

interface OrderSummaryProps {
  canCheckout: boolean
  disabledReason: string
  isProcessing: boolean
  purchasesEnabled: boolean
  rows: string[][]
  productAmountLabel: string
  paymentMethodLabel: string
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
  paymentMethodLabel,
  totalLabel,
  onCheckout
}: OrderSummaryProps) {
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
          className='mt-2 text-[28px] font-medium tracking-[-0.035em] text-white'
        >
          Pesanan
        </h2>
      </div>

      <dl className='mt-7 space-y-4'>
        {rows.map(([label, value]) => (
          <div
            key={label}
            className='grid grid-cols-[88px_minmax(0,1fr)] gap-4 border-t border-white/[0.08] pt-4'
          >
            <dt className='text-xs text-white/[0.4]'>{label}</dt>
            <dd className='break-words text-right text-sm text-white/[0.76]'>
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <dl className='mt-5 space-y-3 border-t border-white/[0.1] pt-5'>
        <div className='flex items-center justify-between gap-4 text-sm'>
          <dt className='text-white/[0.44]'>Harga produk</dt>
          <dd className='text-right text-white/[0.72]'>{productAmountLabel}</dd>
        </div>
        <div className='flex items-center justify-between gap-4 text-sm'>
          <dt className='text-white/[0.44]'>Pembayaran</dt>
          <dd className='text-right text-white/[0.72]'>{paymentMethodLabel}</dd>
        </div>
        <div className='flex items-end justify-between gap-4 border-t border-white/[0.08] pt-4'>
          <dt className='font-mono text-[10px] uppercase tracking-[0.1em] text-white/[0.48]'>
            Total
          </dt>
          <dd className='break-words text-right text-2xl font-medium tracking-[-0.035em] text-white'>
            {totalLabel}
          </dd>
        </div>
      </dl>

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
