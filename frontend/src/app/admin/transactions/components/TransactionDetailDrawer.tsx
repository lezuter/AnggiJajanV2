'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useApi } from '@/hooks/useApi'
import { useDrawer } from '@/components/AdminTemplate'
import type { Transaction, TransactionActivity } from '../types'
import StatusBadge from './StatusBadge'

interface Props {
  isOpen: boolean
  onClose: () => void
  transaction: Transaction | null
  copyToClipboard: (text: string) => void
  onRefresh: () => void
}

type DetailTab = 'OVERVIEW' | 'TIMELINE'

export default function TransactionDetailDrawer ({
  isOpen,
  onClose,
  transaction,
  copyToClipboard,
  onRefresh
}: Props) {
  const { post } = useApi()
  const { setIsDrawerOpen } = useDrawer()
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<DetailTab>('OVERVIEW')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [isRetrying, setIsRetrying] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    setIsDrawerOpen(isOpen)
    if (!isOpen) setActiveTab('OVERVIEW')
    return () => setIsDrawerOpen(false)
  }, [isOpen, setIsDrawerOpen])

  if (!isOpen || !transaction || !mounted) return null

  const drawerRoot = document.getElementById('drawer-root')
  if (!drawerRoot) return null

  const formatIDR = (val: number) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(val)

  const formatDateTime = (dateStr: string) =>
    new Date(dateStr).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })

  const isFailed = transaction.status === 'FAILED'
  const isSuccess =
    transaction.status === 'SUCCESS' || transaction.status === 'PAID'
  const canRetry = isFailed && (transaction.retry_count || 0) < 3
  const providerLabel = (
    transaction.provider_name ||
    transaction.provider ||
    'UNKNOWN'
  ).toUpperCase()
  const actorBadge = getActorBadge(transaction)

  const handleSmartCopy = (text: string, id: string) => {
    copyToClipboard(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleRetry = async () => {
    if (
      !confirm(`Yakin ingin mencoba ulang transaksi ${transaction.invoice_id}?`)
    ) {
      return
    }

    setIsRetrying(true)
    try {
      const res = await post(`/admin/transactions/${transaction.ID}/retry`, {})
      const data = await res.json()
      if (res.ok) {
        alert('Sukses! ' + data.message)
        onRefresh()
        onClose()
      } else {
        alert('Gagal: ' + (data.error || 'Terjadi kesalahan sistem'))
      }
    } catch {
      alert('Error menghubungi server.')
    } finally {
      setIsRetrying(false)
    }
  }

  return createPortal(
    <div className='pointer-events-auto absolute inset-0 h-full w-full'>
      <div className='absolute inset-0 bg-black/5' onClick={onClose} />

      <div
        className={`absolute right-0 top-0 flex h-full w-full flex-col border-l border-white/10 bg-[#0b1020]/95 shadow-[-18px_0_44px_rgba(0,0,0,0.38)] backdrop-blur-2xl transition-transform duration-300 ease-out sm:w-[480px] ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className='border-b border-white/10 bg-white/[0.015] px-6 pb-0 pt-5'>
          <div className='mb-5 flex items-start justify-between gap-4'>
            <div className='min-w-0'>
              <div className='mb-2 flex flex-wrap items-center gap-2'>
                <h2 className='truncate font-mono text-lg font-black text-white'>
                  {transaction.invoice_id}
                </h2>
                <span
                  className={`rounded px-2 py-0.5 text-[8px] font-black uppercase tracking-widest ${actorBadge.className}`}
                >
                  {actorBadge.label}
                </span>
              </div>
              <p className='text-[10px] font-bold uppercase tracking-widest text-slate-500'>
                {formatDateTime(transaction.CreatedAt)}
              </p>
            </div>

            <button
              onClick={onClose}
              className='rounded-full border border-white/10 bg-white/5 p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white'
              title='Tutup'
            >
              <CloseIcon />
            </button>
          </div>

          <div className='flex gap-6'>
            {(['OVERVIEW', 'TIMELINE'] as DetailTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`border-b-2 pb-3 text-xs font-bold uppercase tracking-widest transition-colors ${
                  activeTab === tab
                    ? 'border-[#E491C9] text-[#E491C9]'
                    : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                {tab === 'OVERVIEW' ? 'Overview' : 'Timeline'}
                {tab === 'TIMELINE' && transaction.retry_count > 0 && (
                  <span className='ml-2 rounded-full bg-[#E491C9]/15 px-1.5 py-0.5 text-[8px] text-[#E491C9]'>
                    {transaction.retry_count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className='flex-1 overflow-y-auto px-6 py-5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]'>
          {activeTab === 'OVERVIEW' ? (
            <div className='space-y-7'>
              <section>
                <SectionTitle>Status</SectionTitle>
                <div className='flex flex-wrap items-center gap-3'>
                  <StatusBadge status={transaction.status} />
                  {transaction.digi_status && (
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${
                        isFailed
                          ? 'border-red-500/30 bg-red-500/10 text-red-400'
                          : isSuccess
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                          : 'border-white/10 bg-white/5 text-slate-300'
                      }`}
                    >
                      Prov: {transaction.digi_status}
                    </span>
                  )}
                </div>
              </section>

              <section className='rounded-xl border border-white/[0.07] bg-white/[0.025] p-4'>
                <SectionTitle>Transaksi</SectionTitle>
                <div className='space-y-4'>
                  <FieldRow
                    label='Produk'
                    value={transaction.Product?.name || '-'}
                    subValue={`SKU: ${transaction.Product?.code || '-'}`}
                  />
                  <FieldRow
                    label='Target ID / No HP'
                    value={transaction.customer_phone}
                    accent='sky'
                    action={
                      <CopyButton
                        copied={copiedId === 'target'}
                        onClick={() =>
                          handleSmartCopy(transaction.customer_phone, 'target')
                        }
                      />
                    }
                  />
                  <div className='grid grid-cols-2 gap-3 border-t border-white/[0.07] pt-4'>
                    <MiniStat label='Source' value={actorBadge.label} />
                    <MiniStat
                      label='Payment'
                      value={transaction.payment_method || '-'}
                    />
                    <MiniStat label='Provider' value={providerLabel} amber />
                    <MiniStat
                      label='Provider SKU'
                      value={
                        transaction.provider_sku ||
                        transaction.Product?.code ||
                        '-'
                      }
                      mono
                    />
                  </div>
                  {transaction.reference &&
                    transaction.reference !== transaction.invoice_id && (
                      <FieldRow
                        label='Payment / External Ref'
                        value={transaction.reference}
                        mono
                      />
                    )}
                </div>
              </section>

              <section className='rounded-xl border border-white/[0.07] bg-white/[0.025] p-4'>
                <SectionTitle>Finansial</SectionTitle>
                <MoneyRow
                  label='Harga Jual'
                  value={formatIDR(transaction.amount)}
                />
                <MoneyRow
                  label='Modal'
                  value={formatIDR(transaction.capital || 0)}
                  muted
                />
                <MoneyRow
                  label='Profit Bersih'
                  value={`+${formatIDR(transaction.profit || 0)}`}
                  positive
                  last
                />
              </section>

              <section>
                <SectionTitle>System Log / SN</SectionTitle>
                {transaction.sn ? (
                  <div className='relative'>
                    <div
                      className={`break-words rounded-xl border p-4 pr-10 font-mono text-xs leading-relaxed ${
                        isFailed
                          ? 'border-red-500/20 bg-red-500/5 text-red-400'
                          : 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400'
                      }`}
                    >
                      {transaction.sn}
                    </div>
                    <div className='absolute right-3 top-3'>
                      <CopyButton
                        copied={copiedId === 'sn'}
                        onClick={() => handleSmartCopy(transaction.sn, 'sn')}
                      />
                    </div>
                  </div>
                ) : (
                  <div className='rounded-xl border border-white/10 bg-white/5 p-4 text-center text-xs italic text-slate-500'>
                    Belum ada log dari provider.
                  </div>
                )}
              </section>

              {isFailed && (
                <section className='border-t border-white/10 pt-5'>
                  <SectionTitle>Troubleshooting</SectionTitle>
                  <div className='rounded-xl border border-red-500/20 bg-red-500/5 p-4'>
                    <div className='mb-4 flex items-center justify-between'>
                      <span className='text-xs text-slate-300'>
                        Sisa batas coba ulang
                      </span>
                      <span className='rounded border border-red-500/30 bg-red-500/20 px-2 py-0.5 font-mono text-xs font-bold text-white'>
                        {3 - (transaction.retry_count || 0)} / 3
                      </span>
                    </div>
                    <button
                      onClick={handleRetry}
                      disabled={!canRetry || isRetrying}
                      className='flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/45 bg-red-500/20 py-3 text-xs font-bold uppercase tracking-widest text-red-100 transition-colors hover:bg-red-500 disabled:border-white/10 disabled:bg-white/5 disabled:text-white/30'
                    >
                      <RetryIcon spinning={isRetrying} />
                      {isRetrying
                        ? 'Memproses Ulang...'
                        : 'Coba Ulang Transaksi'}
                    </button>
                  </div>
                </section>
              )}
            </div>
          ) : (
            <TimelineView
              transaction={transaction}
              copied={copiedId === 'provider-ref'}
              onCopyProviderRef={() =>
                handleSmartCopy(transaction.provider_ref || '', 'provider-ref')
              }
            />
          )}
        </div>
      </div>
    </div>,
    drawerRoot
  )
}

function getActorBadge (trx: Transaction) {
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

function SectionTitle ({ children }: { children: ReactNode }) {
  return (
    <h3 className='mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-500'>
      {children}
    </h3>
  )
}

function FieldRow ({
  label,
  value,
  subValue,
  action,
  accent,
  mono
}: {
  label: string
  value: string
  subValue?: string
  action?: ReactNode
  accent?: 'sky'
  mono?: boolean
}) {
  return (
    <div>
      <p className='mb-1 text-[10px] text-slate-500'>{label}</p>
      <div className='flex items-center gap-2'>
        <p
          className={`break-words text-sm font-bold ${
            accent === 'sky' ? 'text-sky-400' : 'text-white'
          } ${mono ? 'font-mono' : ''}`}
        >
          {value}
        </p>
        {action}
      </div>
      {subValue && (
        <p className='mt-0.5 font-mono text-[10px] text-slate-400'>
          {subValue}
        </p>
      )}
    </div>
  )
}

function MiniStat ({
  label,
  value,
  amber,
  mono
}: {
  label: string
  value: string
  amber?: boolean
  mono?: boolean
}) {
  return (
    <div>
      <p className='mb-1 text-[10px] text-slate-500'>{label}</p>
      <p
        className={`text-xs font-bold uppercase ${
          amber ? 'text-amber-300' : 'text-slate-200'
        } ${mono ? 'font-mono' : ''}`}
      >
        {value}
      </p>
    </div>
  )
}

function MoneyRow ({
  label,
  value,
  positive,
  muted,
  last
}: {
  label: string
  value: string
  positive?: boolean
  muted?: boolean
  last?: boolean
}) {
  return (
    <div
      className={`flex items-center justify-between py-3 ${
        last ? '' : 'border-b border-white/[0.07]'
      }`}
    >
      <span className='text-xs text-slate-400'>{label}</span>
      <span
        className={`font-mono text-sm font-bold ${
          positive
            ? 'text-emerald-400'
            : muted
            ? 'text-slate-300'
            : 'text-white'
        }`}
      >
        {value}
      </span>
    </div>
  )
}

function TimelineView ({
  transaction,
  copied,
  onCopyProviderRef
}: {
  transaction: Transaction
  copied: boolean
  onCopyProviderRef: () => void
}) {
  const activities = [...(transaction.activities || [])].sort(
    (a, b) => new Date(a.CreatedAt).getTime() - new Date(b.CreatedAt).getTime()
  )
  const firstActivityTime = activities[0]
    ? new Date(activities[0].CreatedAt).getTime()
    : null

  return (
    <div className='space-y-5'>
      {transaction.provider_ref && (
        <button
          onClick={onCopyProviderRef}
          className='w-fit rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 transition-colors hover:border-[#E491C9]/40 hover:text-[#E491C9]'
        >
          {copied ? 'Copied Provider Ref' : 'Copy Provider Ref'}
        </button>
      )}

      {activities.length === 0 ? (
        <div className='rounded-xl border border-white/10 bg-white/[0.035] px-4 py-8 text-center'>
          <div className='mx-auto mb-3 h-10 w-10 rounded-full border border-white/10 bg-white/5' />
          <p className='text-xs font-medium text-slate-400'>
            Belum ada audit activity untuk transaksi ini.
          </p>
          <p className='mt-1 text-[10px] leading-relaxed text-slate-500'>
            Aktivitas baru akan tercatat saat transaksi dibuat, retry, atau
            callback provider berjalan.
          </p>
        </div>
      ) : (
        <div className='relative ml-2 mt-2 space-y-7 border-l-2 border-white/10 pb-4 pl-6'>
          {activities.map((activity, index) => (
            <ActivityTimelineItem
              key={activity.ID}
              activity={activity}
              providerRef={transaction.provider_ref}
              transactionSN={transaction.sn}
              firstActivityTime={firstActivityTime}
              isFirstActivity={index === 0}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ActivityTimelineItem ({
  activity,
  providerRef,
  transactionSN,
  firstActivityTime,
  isFirstActivity
}: {
  activity: TransactionActivity
  providerRef?: string
  transactionSN?: string
  firstActivityTime: number | null
  isFirstActivity: boolean
}) {
  const actorBadge = getActorBadgeFromActivity(activity)
  const visual = getActivityVisual(activity.action, activity.new_status)
  const hasStatusChange = Boolean(activity.old_status || activity.new_status)
  const description = formatActivityDescription({
    activity,
    actorLabel: actorBadge.label,
    providerRef
  })
  const failureReason = getProviderFailureReason({
    action: activity.action,
    newStatus: activity.new_status,
    transactionSN,
    description,
    providerRef
  })

  return (
    <div className='relative'>
      <span
        className={`absolute -left-[31px] top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 bg-[#11162c] ${visual.nodeClass}`}
      >
        <span className='h-1.5 w-1.5 rounded-full bg-current' />
      </span>
      <div
        className={`rounded-xl border bg-white/[0.025] p-4 shadow-[0_10px_24px_rgba(0,0,0,0.12)] ${visual.cardClass}`}
      >
        <div className='mb-2 flex flex-wrap items-center justify-between gap-2'>
          <div className='flex items-center gap-2'>
            <span
              className={`font-mono text-[10px] font-bold ${visual.textClass}`}
            >
              {formatActivityTime(activity.CreatedAt)}
            </span>
            <span className='rounded-full border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-widest text-slate-500'>
              {formatActivityGap(
                activity.CreatedAt,
                firstActivityTime,
                isFirstActivity
              )}
            </span>
          </div>
          <span
            className={`rounded px-2 py-0.5 text-[8px] font-black uppercase tracking-widest ${visual.badgeClass}`}
          >
            {activity.action || 'UNKNOWN'}
          </span>
        </div>

        <h4 className='text-sm font-bold text-white'>
          {formatActivityAction(activity.action)}
        </h4>
        <p className='mt-2 text-xs leading-relaxed text-slate-300'>
          {description || 'Tidak ada deskripsi.'}
        </p>
        {failureReason && (
          <p className='mt-2 rounded-lg border border-red-500/15 bg-red-500/[0.06] px-2.5 py-2 text-[11px] leading-relaxed text-red-300'>
            <span className='font-bold text-red-300'>Reason:</span>{' '}
            {failureReason}
          </p>
        )}

        <div className='mt-3 flex flex-wrap items-center gap-2'>
          <span
            className={`rounded px-2 py-0.5 text-[8px] font-black uppercase tracking-widest ${actorBadge.className}`}
          >
            {actorBadge.label}
          </span>
          {hasStatusChange && (
            <span className='rounded border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-slate-400'>
              {activity.old_status || '-'} -&gt; {activity.new_status || '-'}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function getActorBadgeFromActivity (activity: TransactionActivity) {
  const user = activity.user

  if (!user) {
    return {
      label: 'SYSTEM',
      className: 'border border-violet-400/25 bg-violet-500/10 text-violet-300'
    }
  }

  const role = user.role?.toLowerCase()

  if (role === 'developer') {
    return {
      label: `DEV • ${user.name}`,
      className: 'border border-cyan-400/30 bg-cyan-500/10 text-cyan-300'
    }
  }

  if (role === 'admin') {
    return {
      label: `ADMIN • ${user.name}`,
      className: 'border border-[#E491C9]/25 bg-[#E491C9]/10 text-[#E491C9]'
    }
  }

  return {
    label: `${user.role?.toUpperCase() || 'USER'} • ${user.name}`,
    className: 'border border-slate-400/25 bg-slate-500/10 text-slate-300'
  }
}

function getActivityVisual (action: string, newStatus = '') {
  const normalized = action.toUpperCase()
  const status = newStatus.toUpperCase()

  if (normalized === 'MANUAL_ORDER_CREATED') {
    return {
      nodeClass: 'border-[#E491C9] text-[#E491C9]',
      textClass: 'text-[#E491C9]',
      badgeClass: 'border border-[#E491C9]/25 bg-[#E491C9]/10 text-[#E491C9]',
      cardClass: 'border-[#E491C9]/15'
    }
  }

  if (normalized === 'MANUAL_PAYMENT_CONFIRMED') {
    return {
      nodeClass: 'border-emerald-500 text-emerald-400',
      textClass: 'text-emerald-400',
      badgeClass:
        'border border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
      cardClass: 'border-emerald-500/15'
    }
  }

  if (normalized === 'PROVIDER_REQUESTED') {
    return {
      nodeClass: 'border-cyan-400 text-cyan-400',
      textClass: 'text-cyan-400',
      badgeClass: 'border border-cyan-400/20 bg-cyan-500/10 text-cyan-300',
      cardClass: 'border-cyan-400/15'
    }
  }

  if (normalized.includes('PROVIDER_RESULT')) {
    if (status === 'FAILED' || status === 'GAGAL') {
      return {
        nodeClass: 'border-red-500 text-red-400',
        textClass: 'text-red-400',
        badgeClass: 'border border-red-500/20 bg-red-500/10 text-red-400',
        cardClass: 'border-red-500/15'
      }
    }

    if (status === 'PAID' || status === 'SUCCESS' || status === 'SUKSES') {
      return {
        nodeClass: 'border-emerald-500 text-emerald-400',
        textClass: 'text-emerald-400',
        badgeClass:
          'border border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
        cardClass: 'border-emerald-500/15'
      }
    }

    return {
      nodeClass: 'border-cyan-400 text-cyan-400',
      textClass: 'text-cyan-400',
      badgeClass: 'border border-cyan-400/20 bg-cyan-500/10 text-cyan-300',
      cardClass: 'border-cyan-400/15'
    }
  }

  if (
    normalized.includes('FAILED') ||
    normalized.includes('GAGAL') ||
    normalized.includes('ERROR')
  ) {
    return {
      nodeClass: 'border-red-500 text-red-400',
      textClass: 'text-red-400',
      badgeClass: 'border border-red-500/20 bg-red-500/10 text-red-400',
      cardClass: 'border-red-500/15'
    }
  }

  if (normalized.includes('RETRY')) {
    return {
      nodeClass: 'border-amber-400 text-amber-400',
      textClass: 'text-amber-400',
      badgeClass: 'border border-amber-500/20 bg-amber-500/10 text-amber-300',
      cardClass: 'border-amber-500/15'
    }
  }

  if (normalized.includes('PROVIDER')) {
    return {
      nodeClass: 'border-cyan-400 text-cyan-400',
      textClass: 'text-cyan-400',
      badgeClass: 'border border-cyan-400/20 bg-cyan-500/10 text-cyan-300',
      cardClass: 'border-cyan-400/15'
    }
  }

  if (normalized.includes('PAYMENT')) {
    return {
      nodeClass: 'border-emerald-500 text-emerald-400',
      textClass: 'text-emerald-400',
      badgeClass:
        'border border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
      cardClass: 'border-emerald-500/15'
    }
  }

  if (normalized.includes('MANUAL') || normalized.includes('CREATED')) {
    return {
      nodeClass: 'border-[#E491C9] text-[#E491C9]',
      textClass: 'text-[#E491C9]',
      badgeClass: 'border border-[#E491C9]/25 bg-[#E491C9]/10 text-[#E491C9]',
      cardClass: 'border-[#E491C9]/15'
    }
  }

  return {
    nodeClass: 'border-violet-400 text-violet-300',
    textClass: 'text-violet-300',
    badgeClass: 'border border-violet-400/25 bg-violet-500/10 text-violet-300',
    cardClass: 'border-white/10'
  }
}

function sanitizeActivityDescription (
  description: string,
  providerRef?: string
) {
  let cleanDescription = description.trim()

  if (providerRef) {
    cleanDescription = cleanDescription.replace(providerRef, '').trim()
  }

  return cleanDescription
    .replace(/(?:Provider\s*Ref|ProviderRef)\s*:\s*\S+/gi, '')
    .replace(/Provider Ref:\s*\.?/gi, '')
    .replace(/ProviderRef:\s*\.?/gi, '')
    .replace(/Ref:\s*$/gi, '')
    .replace(/\s+\./g, '.')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function formatActivityDescription ({
  activity,
  actorLabel,
  providerRef
}: {
  activity: TransactionActivity
  actorLabel: string
  providerRef?: string
}) {
  const action = activity.action?.toUpperCase()
  const cleanDescription = sanitizeActivityDescription(
    activity.description || '',
    providerRef
  )

  if (action === 'MANUAL_PAYMENT_CONFIRMED') {
    if (!cleanDescription) {
      return `Pembayaran manual ditandai diterima oleh ${actorLabel}`
    }

    return cleanDescription.replace(
      /oleh\s+admin\b/gi,
      `oleh ${actorLabel}`
    )
  }

  return cleanDescription
}

function formatActivityAction (action: string) {
  const trimmed = action.trim()
  if (!trimmed) return 'Unknown Activity'

  const actionTitles: Record<string, string> = {
    MANUAL_ORDER_CREATED: 'Manual Order Created',
    MANUAL_PAYMENT_CONFIRMED: 'Manual Payment Confirmed',
    PROVIDER_REQUESTED: 'Provider Requested',
    PROVIDER_RESULT: 'Provider Result',
    RETRY: 'Retry Attempt',
    PAYMENT_PAID: 'Payment Paid'
  }

  const normalized = trimmed.toUpperCase()
  return actionTitles[normalized] || toTitleCase(normalized.replace(/_/g, ' '))
}

function formatActivityTime (dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function formatActivityGap (
  dateStr: string,
  firstActivityTime: number | null,
  isFirstActivity: boolean
) {
  if (isFirstActivity || !firstActivityTime) return 'START'

  const gapSeconds = Math.max(
    0,
    Math.floor((new Date(dateStr).getTime() - firstActivityTime) / 1000)
  )

  return `+${gapSeconds}s`
}

function getProviderFailureReason ({
  action,
  newStatus,
  transactionSN,
  description,
  providerRef
}: {
  action: string
  newStatus: string
  transactionSN?: string
  description: string
  providerRef?: string
}) {
  const normalizedAction = action.toUpperCase()
  const normalizedStatus = newStatus.toUpperCase()

  if (
    !normalizedAction.includes('PROVIDER_RESULT') ||
    normalizedStatus !== 'FAILED'
  ) {
    return ''
  }

  const reason = sanitizeActivityDescription(transactionSN || '', providerRef)
  if (!reason) return ''

  if (description.toLowerCase().includes(reason.toLowerCase())) {
    return ''
  }

  return reason
}

function toTitleCase (text: string) {
  return text
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function CopyButton ({
  copied,
  onClick
}: {
  copied: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className='text-slate-500 transition-colors hover:text-white'
      title='Copy'
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  )
}

function CopyIcon () {
  return (
    <svg
      className='h-4 w-4'
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

function CheckIcon () {
  return (
    <svg
      className='h-4 w-4 text-emerald-400'
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

function CloseIcon () {
  return (
    <svg
      className='h-5 w-5'
      fill='none'
      viewBox='0 0 24 24'
      stroke='currentColor'
    >
      <path
        strokeLinecap='round'
        strokeLinejoin='round'
        strokeWidth='2'
        d='M6 18L18 6M6 6l12 12'
      />
    </svg>
  )
}

function RetryIcon ({ spinning }: { spinning: boolean }) {
  return (
    <svg
      className={`h-4 w-4 ${spinning ? 'animate-spin' : ''}`}
      fill='none'
      viewBox='0 0 24 24'
      stroke='currentColor'
    >
      <path
        strokeLinecap='round'
        strokeLinejoin='round'
        strokeWidth='2'
        d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
      />
    </svg>
  )
}
