'use client'

interface PromoCodeInputProps {
  value: string
  onChange: (value: string) => void
}

const inputClassName =
  'mt-3 h-12 w-full rounded-2xl border border-white/[0.08] bg-white/[0.025] px-4 font-mono text-sm uppercase text-white outline-none transition-[border-color,background-color,box-shadow] duration-300 placeholder:text-white/[0.28] placeholder:font-sans placeholder:normal-case hover:border-white/[0.14] focus:!outline-none focus:border-fuchsia-400/55 focus:bg-fuchsia-400/[0.025] focus:shadow-[0_0_0_3px_rgba(232,121,249,0.10),0_0_24px_rgba(217,70,239,0.08)]'

export default function PromoCodeInput ({
  value,
  onChange
}: PromoCodeInputProps) {
  return (
    <section
      aria-labelledby='promo-code-title'
      className='aj-public-glass relative rounded-[24px] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.3)] sm:p-7'
    >
      <div className='max-w-2xl'>
        <p className='font-mono text-[10px] uppercase tracking-[0.12em] text-white/[0.42]'>
          Promo
        </p>
        <h2
          id='promo-code-title'
          className='mt-2 text-2xl font-medium tracking-[-0.03em] text-white sm:text-[30px]'
        >
          Kode promo
        </h2>
      </div>

      <div className='mt-6 max-w-2xl'>
        <input
          id='promo-input'
          type='text'
          value={value}
          onChange={e => onChange(e.target.value.toUpperCase())}
          placeholder='Masukkan kode promo jika ada'
          className={inputClassName}
        />
      </div>
    </section>
  )
}