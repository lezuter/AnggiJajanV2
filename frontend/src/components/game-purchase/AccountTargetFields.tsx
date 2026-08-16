'use client'

import type { Ref } from 'react'

interface AccountTargetFieldsProps {
  targetType?: string
  targetLabel?: string
  targetSecondaryLabel?: string
  targetServerOptions?: string
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
  'mt-3 h-12 w-full rounded-2xl border border-white/[0.08] bg-white/[0.025] px-4 text-sm text-white outline-none focus:outline-none focus-visible:outline-none transition-[border-color,background-color] duration-300 placeholder:text-white/[0.28] hover:border-white/[0.14]'

export default function AccountTargetFields ({
  targetType = 'SINGLE_ID',
  targetLabel = 'User ID',
  targetSecondaryLabel = 'Zone ID',
  targetServerOptions = '',
  userId,
  zoneId,
  userIdRef,
  zoneIdRef,
  showWarning,
  attention,
  onUserIdChange,
  onZoneIdChange
}: AccountTargetFieldsProps) {
  const isDualInput = targetType === 'DUAL_INPUT'
  const isServerDropdown = targetType === 'SERVER_DROPDOWN'
  const isRiotID = targetType === 'RIOT_ID'
  const isGeneric = targetType === 'GENERIC'

  // Parsing opsi server jika berupa string koma (misal: "Asia, America, Europe")
  const serverOptions = targetServerOptions
    ? targetServerOptions.split(',').map(s => s.trim()).filter(Boolean)
    : ['Asia', 'America', 'Europe', 'TW_HK_MO']

  const isUserIdMissing = showWarning && userId.trim().length === 0
  const isZoneIdMissing = showWarning && (isDualInput || isServerDropdown) && zoneId.trim().length === 0

  const warningMessage =
    isUserIdMissing && isZoneIdMissing
      ? `Lengkapi ${targetLabel} dan ${targetSecondaryLabel} untuk memilih nominal.`
      : isUserIdMissing
      ? `Lengkapi ${targetLabel} untuk memilih nominal.`
      : isZoneIdMissing
      ? `Lengkapi ${targetSecondaryLabel} untuk memilih nominal.`
      : ''

  const placeholderText = isRiotID
    ? 'Riot ID'
    : isGeneric
    ? targetLabel
    : targetLabel.toLowerCase().includes('growid')
    ? 'Masukkan GrowID'
    : `Masukkan ${targetLabel}`

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
          isDualInput || isServerDropdown
            ? 'sm:grid-cols-[minmax(0,1.35fr)_minmax(180px,0.65fr)] sm:items-end'
            : 'max-w-2xl'
        }`}
      >
        {/* Field 1: User ID / UID / GrowID / Riot ID */}
        <div className='min-w-0'>
          <label
            htmlFor='game-user-id'
            className='inline-flex items-center gap-1 text-xs font-medium text-white/[0.68]'
          >
            {targetLabel}
            <span aria-hidden='true' className='text-fuchsia-300/[0.8]'>*</span>
            <span className='sr-only'>Wajib</span>
          </label>
          <input
            ref={userIdRef}
            id='game-user-id'
            name='game-user-id'
            type='text'
            autoComplete='off'
            placeholder={placeholderText}
            className={`${inputClassName} ${
              isUserIdMissing
                ? 'border-fuchsia-400/55 bg-fuchsia-400/[0.025]'
                : ''
            }`}
            value={userId}
            onChange={event => onUserIdChange(event.target.value)}
            required
          />
        </div>

        {/* Field 2A: Zone ID / Server ID (Dual Input) */}
        {isDualInput && (
          <div className='min-w-0'>
            <label
              htmlFor='game-zone-id'
              className='inline-flex items-center gap-1 text-xs font-medium text-white/[0.68]'
            >
              {targetSecondaryLabel}
              <span aria-hidden='true' className='text-fuchsia-300/[0.8]'>*</span>
              <span className='sr-only'>Wajib</span>
            </label>
            <input
              ref={zoneIdRef}
              id='game-zone-id'
              name='game-zone-id'
              type='text'
              autoComplete='off'
              placeholder={`Masukkan ${targetSecondaryLabel}`}
              className={`${inputClassName} ${
                isZoneIdMissing
                  ? 'border-fuchsia-400/55 bg-fuchsia-400/[0.025]'
                  : ''
              }`}
              value={zoneId}
              onChange={event => onZoneIdChange(event.target.value)}
              required
            />
          </div>
        )}

        {/* Field 2B: Server Selector Dropdown (Genshin, Honkai, dll.) */}
        {isServerDropdown && (
          <div className='min-w-0'>
            <label
              htmlFor='game-server-select'
              className='inline-flex items-center gap-1 text-xs font-medium text-white/[0.68]'
            >
              {targetSecondaryLabel}
              <span aria-hidden='true' className='text-fuchsia-300/[0.8]'>*</span>
              <span className='sr-only'>Wajib</span>
            </label>
            <select
              id='game-server-select'
              value={zoneId}
              onChange={e => onZoneIdChange(e.target.value)}
              className={`${inputClassName} cursor-pointer [&>option]:bg-slate-900 [&>option]:text-white`}
              required
            >
              <option value=''>{targetSecondaryLabel}</option>
              {serverOptions.map(srv => (
                <option key={srv} value={srv}>
                  {srv}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </section>
  )
}