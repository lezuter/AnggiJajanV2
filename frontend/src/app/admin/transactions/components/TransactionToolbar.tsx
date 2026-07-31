'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import {
  Calendar,
  Check,
  ChevronDown,
  Code2,
  Database,
  Download,
  Globe,
  RefreshCw,
  Search,
  Server,
  Shield,
  User
} from 'lucide-react'

interface FilterOption {
  label: string
  value: string
  icon?: ReactNode
}

interface FilterDropdownProps {
  label: string
  value: string
  options: FilterOption[]
  onChange: (value: string) => void
  accent?: 'pink' | 'sky' | 'amber' | 'emerald'
}

interface TransactionToolbarProps {
  search: string
  onSearchChange: (value: string) => void
  filterStatus: string
  onFilterChange: (status: string) => void
  dateFilter: string
  onDateChange: (val: string) => void
  filterProvider: string
  onProviderChange: (val: string) => void
  filterSource: string
  onSourceChange: (val: string) => void
  loading: boolean
  onRefresh: () => void
  exporting: boolean
  onExport: () => void
  totalTransactions: number
}

const filters = [
  { label: 'All', value: 'ALL' },
  { label: 'Paid / Success', value: 'PAID' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Failed', value: 'FAILED' }
]

const dateOptions: FilterOption[] = [
  { label: 'Semua Waktu', value: 'ALL', icon: <Calendar className='h-4 w-4' /> },
  { label: 'Hari Ini', value: 'TODAY', icon: <Calendar className='h-4 w-4' /> },
  { label: 'Kemarin', value: 'YESTERDAY', icon: <Calendar className='h-4 w-4' /> },
  { label: '7 Hari Terakhir', value: '7DAYS', icon: <Calendar className='h-4 w-4' /> },
  { label: 'Bulan Ini', value: 'THIS_MONTH', icon: <Calendar className='h-4 w-4' /> }
]

const providerOptions: FilterOption[] = [
  { label: 'All Provider', value: 'ALL', icon: <Database className='h-4 w-4' /> },
  { label: 'Digiflazz', value: 'digiflazz', icon: <Server className='h-4 w-4' /> },
  { label: 'ApiGames', value: 'apigames', icon: <Server className='h-4 w-4' /> },
  { label: 'Manual', value: 'manual', icon: <User className='h-4 w-4' /> }
]

const sourceOptions: FilterOption[] = [
  { label: 'All Source', value: 'ALL', icon: <Globe className='h-4 w-4' /> },
  { label: 'Web / Customer', value: 'WEB', icon: <Globe className='h-4 w-4' /> },
  { label: 'Admin', value: 'ADMIN', icon: <Shield className='h-4 w-4' /> },
  { label: 'Developer', value: 'DEVELOPER', icon: <Code2 className='h-4 w-4' /> },
  { label: 'System', value: 'SYSTEM', icon: <Server className='h-4 w-4' /> }
]

const accentClasses = {
  pink: {
    active: 'border-[#E491C9]/55 bg-[#E491C9]/10 text-[#E491C9]',
    hover: 'hover:border-[#E491C9]/35 hover:text-[#E491C9]',
    ring: 'focus-visible:border-[#E491C9]/60'
  },
  sky: {
    active: 'border-sky-400/55 bg-sky-500/10 text-sky-300',
    hover: 'hover:border-sky-400/35 hover:text-sky-300',
    ring: 'focus-visible:border-sky-400/60'
  },
  amber: {
    active: 'border-amber-400/55 bg-amber-500/10 text-amber-300',
    hover: 'hover:border-amber-400/35 hover:text-amber-300',
    ring: 'focus-visible:border-amber-400/60'
  },
  emerald: {
    active: 'border-emerald-400/55 bg-emerald-500/10 text-emerald-300',
    hover: 'hover:border-emerald-400/35 hover:text-emerald-300',
    ring: 'focus-visible:border-emerald-400/60'
  }
}

export default function TransactionToolbar ({
  search,
  onSearchChange,
  filterStatus,
  onFilterChange,
  loading,
  dateFilter,
  onDateChange,
  filterProvider,
  onProviderChange,
  filterSource,
  onSourceChange,
  onRefresh,
  exporting,
  onExport,
  totalTransactions
}: TransactionToolbarProps) {
  return (
    <div className='relative z-[80] mb-6 rounded-2xl border border-white/[0.06] bg-white/[0.018] p-5 shadow-[0_8px_28px_rgba(0,0,0,0.14)] backdrop-blur-[80px]'>
      <div className='pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.15] to-transparent opacity-40' />

      <div className='relative z-[81] flex flex-col gap-5'>
        <div className='flex flex-col gap-3 xl:flex-row xl:items-center'>
          <div className='relative min-w-[240px] flex-1'>
            <div className='pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4'>
              <Search className='h-5 w-5 text-slate-500' />
            </div>
            <input
              type='text'
              value={search}
              onChange={e => onSearchChange(e.target.value)}
              placeholder='Cari invoice, target, SKU, provider, admin, SN...'
              className='w-full rounded-xl border border-white/10 bg-white/[0.025] py-3.5 pl-12 pr-4 text-sm text-white outline-none transition-all placeholder:text-slate-500 focus:border-[#E491C9]/50 focus:bg-white/[0.04]'
            />
          </div>

          <div className='flex flex-col gap-3 sm:flex-row sm:flex-wrap xl:flex-nowrap'>
            <FilterDropdown
              label='Tanggal'
              value={dateFilter}
              options={dateOptions}
              onChange={onDateChange}
              accent='pink'
            />
            <FilterDropdown
              label='Provider'
              value={filterProvider}
              options={providerOptions}
              onChange={onProviderChange}
              accent='sky'
            />
            <FilterDropdown
              label='Source'
              value={filterSource}
              options={sourceOptions}
              onChange={onSourceChange}
              accent='amber'
            />

            <button
              onClick={onRefresh}
              className='flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3.5 text-sm font-bold uppercase tracking-widest text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] transition-all hover:bg-white/10 active:scale-95'
            >
              <RefreshCw
                className={`h-5 w-5 ${loading ? 'animate-spin text-[#E491C9]' : ''}`}
              />
              Refresh
            </button>

            <button
              onClick={onExport}
              disabled={exporting || totalTransactions === 0}
              className='flex shrink-0 items-center justify-center gap-2 rounded-xl border border-[#E491C9]/25 bg-[#E491C9]/10 px-5 py-3.5 text-sm font-bold uppercase tracking-widest text-[#E491C9] shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] transition-all hover:border-[#E491C9]/45 hover:bg-[#E491C9]/15 active:scale-95 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.03] disabled:text-slate-600'
              title='Export transaksi sesuai filter aktif'
            >
              <Download
                className={`h-5 w-5 ${exporting ? 'animate-pulse' : ''}`}
              />
              {exporting ? 'Exporting' : 'Export CSV'}
            </button>
          </div>
        </div>

        <div className='flex flex-col items-center justify-between gap-4 border-t border-white/[0.05] pt-4 md:flex-row'>
          <div className='flex w-full flex-wrap gap-2 md:w-auto'>
            {filters.map(f => {
              const isActive = filterStatus === f.value
              return (
                <button
                  key={f.value}
                  onClick={() => onFilterChange(f.value)}
                  className={clsx(
                    'flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all duration-300',
                    isActive
                      ? 'border-[#E491C9]/50 bg-[#E491C9]/10 text-[#E491C9] shadow-[0_0_15px_rgba(228,145,201,0.15)]'
                      : 'border-white/10 text-slate-400 hover:border-[#E491C9]/30 hover:bg-white/5 hover:text-white'
                  )}
                >
                  <span
                    className={clsx(
                      'h-1.5 w-1.5 rounded-full',
                      isActive ? 'animate-pulse bg-[#E491C9]' : 'bg-slate-600'
                    )}
                  />
                  {f.label}
                </button>
              )
            })}
          </div>

          <div className='flex shrink-0 items-center gap-6'>
            <div className='text-right'>
              <span className='font-mono text-2xl font-bold text-white drop-shadow-md'>
                {totalTransactions}
              </span>
              <span className='block text-[10px] uppercase tracking-[0.2em] text-slate-500'>
                Total Data
              </span>
            </div>

            <div className='flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5'>
              <span className='absolute h-2 w-2 animate-ping rounded-full bg-emerald-400' />
              <span className='relative h-2 w-2 rounded-full bg-emerald-400' />
              <span className='text-[10px] font-bold uppercase tracking-widest text-emerald-400'>
                Live 10s
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function FilterDropdown ({
  label,
  value,
  options,
  onChange,
  accent = 'pink'
}: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement | null>(null)
  const selected = options.find(option => option.value === value) || options[0]
  const styles = accentClasses[accent]

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  return (
    <div ref={dropdownRef} className='relative min-w-[172px]'>
      <button
        type='button'
        onClick={() => setIsOpen(open => !open)}
        className={clsx(
          'flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3 text-left text-sm text-slate-200 outline-none transition-all hover:bg-white/[0.065] focus-visible:bg-white/[0.065]',
          styles.ring,
          isOpen && styles.active
        )}
      >
        <span className='flex min-w-0 items-center gap-2'>
          <span className='shrink-0 text-slate-400'>{selected.icon}</span>
          <span className='min-w-0'>
            <span className='block text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500'>
              {label}
            </span>
            <span className='block truncate font-semibold'>{selected.label}</span>
          </span>
        </span>
        <ChevronDown
          className={clsx(
            'h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200',
            isOpen && 'rotate-180 text-slate-300'
          )}
        />
      </button>

      {isOpen && (
        <div className='absolute right-0 top-[calc(100%+0.5rem)] z-[120] w-full min-w-[210px] overflow-hidden rounded-xl border border-white/10 bg-[#10142b]/95 p-1.5 shadow-[0_18px_48px_rgba(0,0,0,0.45)] backdrop-blur-2xl'>
          {options.map(option => {
            const active = option.value === value
            return (
              <button
                key={option.value}
                type='button'
                onClick={() => {
                  onChange(option.value)
                  setIsOpen(false)
                }}
                className={clsx(
                  'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-all',
                  active
                    ? styles.active
                    : clsx('border border-transparent text-slate-400 hover:bg-white/[0.05]', styles.hover)
                )}
              >
                <span className='flex min-w-0 items-center gap-2'>
                  <span className='shrink-0'>{option.icon}</span>
                  <span className='truncate font-semibold'>{option.label}</span>
                </span>
                {active && <Check className='h-4 w-4 shrink-0' />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
