'use client'

import React from 'react'

interface PromoCodeInputProps {
  value: string
  onChange: (value: string) => void
  onApply?: () => void
  isApplying?: boolean
  disabled?: boolean
  appliedSuccess?: boolean
  errorMessage?: string
}

const inputClassName =
  'h-12 w-full rounded-2xl border border-white/[0.08] bg-white/[0.025] px-4 font-mono text-sm uppercase text-white outline-none transition-[border-color,background-color,box-shadow] duration-300 placeholder:text-white/[0.28] placeholder:font-sans placeholder:normal-case hover:border-white/[0.14] focus:!outline-none focus:border-fuchsia-400/55 focus:bg-fuchsia-400/[0.025] focus:shadow-[0_0_0_3px_rgba(232,121,249,0.10),0_0_24px_rgba(217,70,239,0.08)] disabled:cursor-not-allowed disabled:opacity-40'

export default function PromoCodeInput ({
  value,
  onChange,
  onApply,
  isApplying = false,
  disabled = false,
  appliedSuccess = false,
  errorMessage
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
        <label
          htmlFor='promo-input'
          className='text-xs font-medium text-white/[0.68]'
        >
          Kode Voucher / Promo
        </label>
        <div className='mt-3 flex gap-2.5 sm:gap-3'>
          <input
            id='promo-input'
            type='text'
            value={value}
            disabled={disabled || appliedSuccess}
            onChange={e => onChange(e.target.value.toUpperCase())}
            placeholder='Masukkan kode promo'
            className={inputClassName}
          />
          <button
            type='button'
            onClick={onApply}
            disabled={disabled || !value.trim() || isApplying}
            className='min-h-12 shrink-0 rounded-2xl border border-white bg-white px-5 text-sm font-semibold text-black transition-all duration-300 hover:border-fuchsia-300 hover:bg-fuchsia-300 hover:shadow-[0_12px_34px_rgba(217,70,239,0.18)] focus-visible:ring-2 focus-visible:ring-fuchsia-400/70 disabled:cursor-not-allowed disabled:border-white/[0.08] disabled:bg-white/[0.04] disabled:text-white/[0.34]'
          >
            {isApplying ? 'Mengecek...' : appliedSuccess ? 'Terpasang' : 'Gunakan'}
          </button>
        </div>

        {errorMessage && (
          <p className='mt-2 text-xs text-rose-300/[0.8]'>
            {errorMessage}
          </p>
        )}
        {appliedSuccess && (
          <p className='mt-2 text-xs text-emerald-300/[0.8]'>
            Kode promo berhasil digunakan!
          </p>
        )}
      </div>
    </section>
  )
}