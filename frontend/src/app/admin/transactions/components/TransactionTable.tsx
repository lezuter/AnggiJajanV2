'use client'

import { useState, type MouseEvent } from 'react'
import StatusBadge from './StatusBadge'
import type { Transaction } from '../types'

interface TransactionTableProps {
  loading: boolean
  currentItems: Transaction[]
  search: string
  copyToClipboard: (text: string) => void
  onRowClick: (trx: Transaction) => void
}

export default function TransactionTable ({
  loading,
  currentItems,
  search,
  copyToClipboard,
  onRowClick
}: TransactionTableProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const formatIDR = (val: number) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(val)

  const timeAgo = (dateStr: string) => {
    const seconds = Math.floor(
      (new Date().getTime() - new Date(dateStr).getTime()) / 1000
    )
    let interval = seconds / 31536000
    if (interval > 1) return Math.floor(interval) + ' tahun lalu'
    interval = seconds / 2592000
    if (interval > 1) return Math.floor(interval) + ' bulan lalu'
    interval = seconds / 86400
    if (interval > 1) return Math.floor(interval) + ' hari lalu'
    interval = seconds / 3600
    if (interval > 1) return Math.floor(interval) + ' jam lalu'
    interval = seconds / 60
    if (interval > 1) return Math.floor(interval) + ' menit lalu'
    return 'Baru saja'
  }

  const handleSmartCopy = (e: MouseEvent, text: string, id: string) => {
    e.stopPropagation()
    copyToClipboard(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const getActorBadge = (trx: Transaction) => {
    const via = trx.created_via?.toUpperCase()
    const role = trx.created_by_role?.toLowerCase()
    const name = trx.created_by_name?.trim() || ''

    if (via === 'ADMIN') {
      if (!name) {
        return {
          label: 'ADMIN • LEGACY',
          className: 'bg-[#E491C9]/10 text-[#E491C9] border border-[#E491C9]/25'
        }
      }

      if (role === 'developer') {
        return {
          label: `DEV • ${name}`,
          className: 'bg-cyan-500/10 text-cyan-300 border border-cyan-400/30'
        }
      }

      return {
        label: `ADMIN • ${name}`,
        className: 'bg-[#E491C9]/10 text-[#E491C9] border border-[#E491C9]/25'
      }
    }

    if (via === 'CUSTOMER' || via === 'WEB') {
      return {
        label: 'WEB • SYSTEM',
        className: 'bg-sky-500/10 text-sky-400 border border-sky-500/25'
      }
    }

    return {
      label: `${via || 'SYSTEM'} • SYSTEM`,
      className: 'bg-violet-500/10 text-violet-300 border border-violet-400/25'
    }
  }

  return (
    <div className='relative max-h-[68vh] overflow-x-auto overflow-y-auto rounded-xl pb-0 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20'>
      <table className='w-full border-collapse whitespace-nowrap text-left'>
        <thead className='sticky top-0 z-20 border-b border-white/[0.08] bg-[#15173d]/95 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.5)] backdrop-blur-xl'>
          <tr>
            {[
              'Invoice & Waktu',
              'Produk & Jalur',
              'Target & Payment',
              'Nominal & Profit',
              'Status',
              'System Log / SN'
            ].map((label, index) => (
              <th
                key={label}
                className={`px-5 py-4 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 ${
                  index === 3 ? 'text-right' : index === 4 ? 'text-center' : 'text-left'
                }`}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className='text-sm'>
          {loading ? (
            [...Array(5)].map((_, i) => (
              <tr key={i} className='border-b border-white/[0.03]'>
                <td colSpan={6} className='px-5 py-6'>
                  <div className='h-5 animate-pulse rounded bg-white/5' />
                </td>
              </tr>
            ))
          ) : currentItems.length === 0 ? (
            <tr>
              <td
                colSpan={6}
                className='py-24 text-center font-mono text-xs font-bold uppercase tracking-widest text-slate-500/70'
              >
                Data tidak ditemukan.
              </td>
            </tr>
          ) : (
            currentItems.map(trx => {
              const isFailed = trx.status === 'FAILED'
              const isSuccess =
                trx.status === 'SUCCESS' || trx.status === 'PAID'
              const actorBadge = getActorBadge(trx)
              const providerLabel = (
                trx.provider_name ||
                trx.provider ||
                'UNKNOWN'
              ).toUpperCase()

              return (
                <tr
                  key={trx.ID}
                  onClick={() => onRowClick(trx)}
                  className={`group cursor-pointer border-b border-white/[0.035] transition-colors duration-200 hover:bg-white/[0.035] hover:shadow-[inset_3px_0_0_#E491C9] ${
                    isFailed ? 'bg-red-500/[0.025]' : ''
                  }`}
                >
                  <td className='px-5 py-4 align-middle'>
                    <div className='flex items-center gap-2'>
                      <span
                        className={`font-mono text-xs font-bold ${
                          search && trx.invoice_id.includes(search)
                            ? 'text-[#E491C9]'
                            : 'text-slate-100 group-hover:text-white'
                        }`}
                      >
                        {trx.invoice_id}
                      </span>
                      <button
                        onClick={e =>
                          handleSmartCopy(e, trx.invoice_id, `inv-${trx.ID}`)
                        }
                        className='opacity-45 transition-opacity hover:opacity-100 group-hover:opacity-100'
                        title='Copy invoice'
                      >
                        {copiedId === `inv-${trx.ID}` ? (
                          <CheckIcon className='text-emerald-400' />
                        ) : (
                          <CopyIcon className='text-slate-500 hover:text-[#E491C9]' />
                        )}
                      </button>
                    </div>
                    <div className='mt-1 text-[10px] font-medium tracking-wide text-slate-500 transition-colors group-hover:text-slate-400'>
                      {new Date(trx.CreatedAt).toLocaleString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                      <span className='ml-1.5 font-normal text-sky-400/80'>
                        ({timeAgo(trx.CreatedAt)})
                      </span>
                    </div>
                  </td>

                  <td className='px-5 py-4 align-middle'>
                    <div className='max-w-[220px] truncate text-xs font-bold text-slate-100 group-hover:text-white'>
                      {trx.Product?.name || '-'}
                    </div>
                    <div className='mt-1.5 flex items-center gap-2'>
                      <div
                        className={`rounded px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest ${actorBadge.className}`}
                      >
                        {actorBadge.label}
                      </div>
                      <span className='rounded border border-white/5 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[9px] uppercase text-slate-500'>
                        {trx.Product?.code || '-'}
                      </span>
                      <span className='rounded border border-amber-500/10 bg-amber-500/[0.08] px-1.5 py-0.5 font-mono text-[9px] uppercase text-amber-300/90'>
                        {providerLabel}
                      </span>
                    </div>
                  </td>

                  <td className='px-5 py-4 align-middle'>
                    <div className='flex items-center gap-2'>
                      <span className='font-mono text-xs font-bold text-sky-400 transition-colors group-hover:text-sky-300'>
                        {trx.target}
                      </span>
                      <button
                        onClick={e =>
                          handleSmartCopy(
                            e,
                            trx.target,
                            `tgt-${trx.ID}`
                          )
                        }
                        className='opacity-45 transition-opacity hover:opacity-100 group-hover:opacity-100'
                        title='Copy target'
                      >
                        {copiedId === `tgt-${trx.ID}` ? (
                          <CheckIcon className='text-emerald-400' />
                        ) : (
                          <CopyIcon className='text-slate-500 hover:text-sky-400' />
                        )}
                      </button>
                    </div>
                    <div className='mt-1 max-w-[170px] truncate font-mono text-[9px] uppercase tracking-widest text-slate-500'>
                      Pay: {trx.payment_method || '-'}
                    </div>
                    {trx.reference && trx.reference !== trx.invoice_id && (
                      <div
                        className='mt-1 max-w-[170px] truncate font-mono text-[9px] uppercase tracking-widest text-slate-500'
                        title={trx.reference}
                      >
                        Ref: {trx.reference}
                      </div>
                    )}
                  </td>

                  <td className='px-5 py-4 text-right align-middle'>
                    <div className='font-mono text-sm font-black text-white transition-colors group-hover:text-emerald-50'>
                      {formatIDR(trx.amount)}
                    </div>
                    {trx.profit > 0 && (
                      <div className='mt-0.5 font-mono text-[10px] font-bold tracking-wider text-emerald-400/90'>
                        +{formatIDR(trx.profit)}
                      </div>
                    )}
                  </td>

                  <td className='px-5 py-4 text-center align-middle'>
                    <div className='flex flex-col items-center gap-1.5'>
                      <StatusBadge status={trx.status} />
                      {trx.digi_status && (
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[8.5px] font-bold uppercase tracking-widest transition-colors ${
                            isFailed
                              ? 'border-red-500/20 bg-red-500/10 text-red-400'
                              : 'border-white/10 bg-white/5 text-slate-400'
                          }`}
                        >
                          Prov: {trx.digi_status}
                        </span>
                      )}
                    </div>
                  </td>

                  <td className='max-w-[220px] px-5 py-4 align-middle'>
                    {isSuccess && trx.sn ? (
                      <button
                        onClick={e =>
                          handleSmartCopy(e, trx.sn, `sn-${trx.ID}`)
                        }
                        className='group/sn flex w-full items-center gap-2 text-left focus:outline-none'
                        title='Copy SN'
                      >
                        <span className='truncate font-mono text-[10px] text-emerald-400/80 group-hover/sn:text-emerald-300'>
                          SN: {trx.sn}
                        </span>
                        {copiedId === `sn-${trx.ID}` ? (
                          <CheckIcon className='shrink-0 text-emerald-400' />
                        ) : (
                          <CopyIcon className='shrink-0 text-slate-500 opacity-45 transition-opacity hover:text-emerald-300 group-hover/sn:opacity-100' />
                        )}
                      </button>
                    ) : isFailed && trx.sn ? (
                      <div
                        className='line-clamp-2 rounded border border-red-500/10 bg-red-500/5 p-1.5 text-[10px] font-medium leading-relaxed text-red-400/90'
                        title={trx.sn}
                      >
                        {trx.sn}
                      </div>
                    ) : (
                      <span className='text-xs font-bold text-slate-600'>-</span>
                    )}
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}

function CopyIcon ({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`h-3.5 w-3.5 ${className}`}
      fill='none'
      viewBox='0 0 24 24'
      stroke='currentColor'
    >
      <path
        strokeLinecap='round'
        strokeLinejoin='round'
        strokeWidth='2'
        d='M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z'
      />
    </svg>
  )
}

function CheckIcon ({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`h-4 w-4 ${className}`}
      fill='none'
      viewBox='0 0 24 24'
      stroke='currentColor'
    >
      <path
        strokeLinecap='round'
        strokeLinejoin='round'
        strokeWidth='2'
        d='M5 13l4 4L19 7'
      />
    </svg>
  )
}
