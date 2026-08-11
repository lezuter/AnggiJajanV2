'use client'

interface QuantitySelectorProps {
  quantity: number
  onChange: (quantity: number) => void
  disabled?: boolean
}

export default function QuantitySelector ({
  quantity,
  onChange,
  disabled = false
}: QuantitySelectorProps) {
  return (
    <section
      aria-label='Jumlah Pembelian'
      className='aj-public-glass relative rounded-[24px] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.3)] sm:p-7'
    >
      <div className='flex flex-wrap items-center justify-between gap-4'>
        <div>
          <p className='font-mono text-[10px] uppercase tracking-[0.12em] text-white/[0.42]'>
            Jumlah
          </p>
          <h2 className='mt-2 text-2xl font-medium tracking-[-0.03em] text-white sm:text-[30px]'>
            Jumlah pembelian
          </h2>
          <p className='mt-2 text-sm leading-6 text-white/[0.5]'>
            Tentukan jumlah unit produk yang ingin dibeli.
          </p>
        </div>

        <div className='flex items-center gap-3 rounded-full border border-white/[0.1] bg-white/[0.03] p-1.5'>
          <button
            type='button'
            onClick={() => onChange(Math.max(1, quantity - 1))}
            disabled={disabled || quantity <= 1}
            className='flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-white transition-colors hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-30'
            aria-label='Kurangi jumlah'
          >
            -
          </button>
          <span className={`w-8 text-center font-mono text-base font-semibold ${disabled ? 'text-white/40' : 'text-white'}`}>
            {quantity}
          </span>
          <button
            type='button'
            onClick={() => onChange(quantity + 1)}
            disabled={disabled}
            className='flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-white transition-colors hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-30'
            aria-label='Tambah jumlah'
          >
            +
          </button>
        </div>
      </div>
    </section>
  )
}