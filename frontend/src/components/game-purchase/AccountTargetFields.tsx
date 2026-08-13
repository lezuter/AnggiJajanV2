'use client'

import type { Ref } from 'react'

interface AccountTargetFieldsProps {
  requiresZone: boolean
  userId: string
  zoneId: string
  userIdRef: Ref<HTMLInputElement>
  zoneIdRef: Ref<HTMLInputElement>
  showWarning: boolean
  attention: boolean
  onUserIdChange: (value: string) => void
  onZoneIdChange: (value: string) => void
}

const inputClassName =
  'mt-3 h-12 w-full rounded-2xl border border-white/[0.08] bg-white/[0.025] px-4 text-sm text-white outline-none transition-[border-color,background-color,box-shadow] duration-300 placeholder:text-white/[0.28] hover:border-white/[0.14] focus:!outline-none focus:border-fuchsia-400/55 focus:bg-fuchsia-400/[0.025] focus:shadow-[0_0_0_3px_rgba(232,121,249,0.10),0_0_24px_rgba(217,70,239,0.08)] focus-visible:!outline-none [&:user-invalid]:border-fuchsia-400/55 [&:user-invalid]:bg-fuchsia-400/[0.025] [&:user-invalid]:shadow-[0_0_0_3px_rgba(232,121,249,0.10),0_0_24px_rgba(217,70,239,0.08)]'

export default function AccountTargetFields ({
  requiresZone,
  userId,
  zoneId,
  userIdRef,
  zoneIdRef,
  showWarning,
  attention,
  onUserIdChange,
  onZoneIdChange
}: AccountTargetFieldsProps) {
  const isUserIdMissing = showWarning && userId.trim().length === 0
  const isZoneIdMissing =
    showWarning && requiresZone && zoneId.trim().length === 0
  const warningMessage =
    isUserIdMissing && isZoneIdMissing
      ? 'Lengkapi User ID dan Zone ID untuk memilih nominal.'
      : isUserIdMissing
      ? 'Lengkapi User ID untuk memilih nominal.'
      : isZoneIdMissing
      ? 'Lengkapi Zone ID untuk memilih nominal.'
      : ''

  return (
    <section
      aria-labelledby='account-target-title'
      aria-describedby={warningMessage ? 'account-target-warning' : undefined}
      className={`rounded-[24px] border bg-black/[0.035] p-5 backdrop-blur-md backdrop-saturate-150 transition-[border-color,box-shadow] duration-500 sm:p-7 ${
        attention
          ? 'border-fuchsia-300/45 shadow-[0_0_0_1px_rgba(232,121,249,0.16),0_22px_70px_rgba(0,0,0,0.22),0_0_38px_rgba(217,70,239,0.16)]'
          : 'border-white/[0.08] shadow-[0_22px_70px_rgba(0,0,0,0.22)]'
      }`}
    >
      <div className='max-w-2xl'>
        <p className='font-mono text-[10px] uppercase tracking-[0.12em] text-white/[0.42]'>
          Data akun
        </p>

        <h2
          id='account-target-title'
          className='mt-2 text-2xl font-medium tracking-[-0.03em] text-white sm:text-[28px]'
        >
          Tujuan top up
        </h2>

        <p className='mt-2 text-sm leading-6 text-white/[0.5]'>
          Pastikan data akun sudah benar sebelum melanjutkan pembayaran.
        </p>

        {warningMessage && (
          <p
            id='account-target-warning'
            role='alert'
            className='mt-3 text-xs leading-5 text-fuchsia-200/[0.8]'
          >
            {warningMessage}
          </p>
        )}
      </div>

      <div
        className={`mt-7 grid gap-5 ${
          requiresZone
            ? 'sm:grid-cols-[minmax(0,1.35fr)_minmax(180px,0.65fr)] sm:items-end'
            : 'max-w-2xl'
        }`}
      >
        <div className='min-w-0'>
          <label
            htmlFor='game-user-id'
            className='inline-flex items-center gap-1 text-xs font-medium text-white/[0.68]'
          >
            User ID
            <span
              aria-hidden='true'
              className='text-fuchsia-300/[0.8]'
            >
              *
            </span>
            <span className='sr-only'>Wajib</span>
          </label>
          <input
            ref={userIdRef}
            id='game-user-id'
            name='game-user-id'
            type='text'
            autoComplete='off'
            placeholder='Masukkan User ID'
            className={`${inputClassName} ${
              isUserIdMissing
                ? 'border-fuchsia-400/55 bg-fuchsia-400/[0.025] shadow-[0_0_0_3px_rgba(232,121,249,0.10),0_0_24px_rgba(217,70,239,0.08)]'
                : ''
            }`}
            value={userId}
            aria-invalid={isUserIdMissing}
            aria-describedby={
              warningMessage ? 'account-target-warning' : undefined
            }
            onChange={event => onUserIdChange(event.target.value)}
            required
          />
        </div>

        {requiresZone && (
          <div className='min-w-0'>
            <label
              htmlFor='game-zone-id'
              className='inline-flex items-center gap-1 text-xs font-medium text-white/[0.68]'
            >
              Zone ID
              <span
                aria-hidden='true'
                className='text-fuchsia-300/[0.8]'
              >
                *
              </span>
              <span className='sr-only'>Wajib</span>
            </label>
            <input
              ref={zoneIdRef}
              id='game-zone-id'
              name='game-zone-id'
              type='text'
              autoComplete='off'
              placeholder='Masukkan Zone ID'
              className={`${inputClassName} ${
                isZoneIdMissing
                  ? 'border-fuchsia-400/55 bg-fuchsia-400/[0.025] shadow-[0_0_0_3px_rgba(232,121,249,0.10),0_0_24px_rgba(217,70,239,0.08)]'
                  : ''
              }`}
              value={zoneId}
              aria-invalid={isZoneIdMissing}
              aria-describedby={
                warningMessage ? 'account-target-warning' : undefined
              }
              onChange={event => onZoneIdChange(event.target.value)}
              required
            />
          </div>
        )}
      </div>
    </section>
  )
}
