'use client'

import { type FormEvent, useState } from 'react'
import {
  FolderTree,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X
} from 'lucide-react'

import { Checkbox } from '@/components/ui/checkbox'

export interface ProductGroup {
  ID: number
  name: string
  catalog_cardcode: string
  sort_order: number
  is_active: boolean
  product_count?: number
  products?: Array<{ ID: number }>
}

export interface ProductGroupInput {
  name: string
  sort_order: number
  is_active: boolean
}

export type ProductGroupFilter = 'all' | 'ungrouped' | number

interface ProductGroupManagerProps {
  catalog: {
    cardcode: string
    name: string
  }
  groups: ProductGroup[]
  loading: boolean
  isMutating: boolean
  loadError?: string | null
  activeFilter: ProductGroupFilter
  totalCount: number
  ungroupedCount: number
  groupProductCounts: Record<number, number>
  onFilterChange: (filter: ProductGroupFilter) => void
  onCreate: (input: ProductGroupInput) => Promise<void>
  onUpdate: (groupID: number, input: ProductGroupInput) => Promise<void>
  onDelete: (group: ProductGroup) => Promise<void>
  onRefresh: () => Promise<void>
}

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback

const validateGroupInput = (
  name: string,
  rawSortOrder: string
): ProductGroupInput | null => {
  const normalizedName = name.trim()
  const sortOrder = Number(rawSortOrder)

  if (!normalizedName) return null
  if (!Number.isInteger(sortOrder) || sortOrder < 0) return null

  return {
    name: normalizedName,
    sort_order: sortOrder,
    is_active: true
  }
}

export default function ProductGroupManager({
  catalog,
  groups,
  loading,
  isMutating,
  loadError,
  activeFilter,
  totalCount,
  ungroupedCount,
  groupProductCounts,
  onFilterChange,
  onCreate,
  onUpdate,
  onDelete,
  onRefresh
}: ProductGroupManagerProps) {
  const [createName, setCreateName] = useState('')
  const [createSortOrder, setCreateSortOrder] = useState('0')
  const [createIsActive, setCreateIsActive] = useState(true)
  const [editingGroupID, setEditingGroupID] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editSortOrder, setEditSortOrder] = useState('0')
  const [editIsActive, setEditIsActive] = useState(true)
  const [feedback, setFeedback] = useState<{
    type: 'error' | 'success'
    message: string
  } | null>(null)

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const input = validateGroupInput(createName, createSortOrder)
    if (!input) {
      setFeedback({
        type: 'error',
        message: 'Nama kelompok wajib diisi dan urutan harus berupa bilangan bulat nol atau lebih.'
      })
      return
    }

    try {
      setFeedback(null)
      await onCreate({ ...input, is_active: createIsActive })
      setCreateName('')
      setCreateSortOrder('0')
      setCreateIsActive(true)
      setFeedback({
        type: 'success',
        message: `Kelompok ${input.name} berhasil dibuat.`
      })
    } catch (error) {
      setFeedback({
        type: 'error',
        message: getErrorMessage(error, 'Kelompok produk gagal dibuat.')
      })
    }
  }

  const beginEditing = (group: ProductGroup) => {
    setEditingGroupID(group.ID)
    setEditName(group.name)
    setEditSortOrder(String(group.sort_order))
    setEditIsActive(group.is_active)
    setFeedback(null)
  }

  const cancelEditing = () => {
    if (isMutating) return
    setEditingGroupID(null)
  }

  const handleUpdate = async (
    event: FormEvent<HTMLFormElement>,
    groupID: number
  ) => {
    event.preventDefault()

    const input = validateGroupInput(editName, editSortOrder)
    if (!input) {
      setFeedback({
        type: 'error',
        message: 'Nama kelompok wajib diisi dan urutan harus berupa bilangan bulat nol atau lebih.'
      })
      return
    }

    try {
      setFeedback(null)
      await onUpdate(groupID, { ...input, is_active: editIsActive })
      setEditingGroupID(null)
      setFeedback({
        type: 'success',
        message: `Kelompok ${input.name} berhasil diperbarui.`
      })
    } catch (error) {
      setFeedback({
        type: 'error',
        message: getErrorMessage(error, 'Kelompok produk gagal diperbarui.')
      })
    }
  }

  const handleDelete = async (group: ProductGroup) => {
    const productCount = groupProductCounts[group.ID] ?? 0
    const confirmation = window.confirm(
      `Hapus kelompok "${group.name}"? ${productCount} produk di dalamnya akan menjadi Belum dikelompokkan.`
    )

    if (!confirmation) return

    try {
      setFeedback(null)
      await onDelete(group)
      if (editingGroupID === group.ID) {
        setEditingGroupID(null)
      }
      setFeedback({
        type: 'success',
        message: `Kelompok ${group.name} dihapus. Produknya kini belum dikelompokkan.`
      })
    } catch (error) {
      setFeedback({
        type: 'error',
        message: getErrorMessage(error, 'Kelompok produk gagal dihapus.')
      })
    }
  }

  const handleRefresh = async () => {
    try {
      setFeedback(null)
      await onRefresh()
    } catch (error) {
      setFeedback({
        type: 'error',
        message: getErrorMessage(error, 'Kelompok produk gagal dimuat ulang.')
      })
    }
  }

  return (
    <section
      aria-labelledby="product-group-manager-title"
      className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-4 sm:p-5"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-fuchsia-400/20 bg-fuchsia-400/[0.08] text-fuchsia-200">
            <FolderTree size={18} />
          </span>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-fuchsia-200/65">
              Product groups
            </p>
            <h2
              id="product-group-manager-title"
              className="mt-1 text-base font-semibold text-white"
            >
              Kelompok produk · {catalog.name}
            </h2>
            <p className="mt-1 text-xs leading-5 text-white/40">
              Nama dan urutan ini menjadi struktur produk di halaman game.
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={loading || isMutating}
          onClick={() => void handleRefresh()}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3.5 text-xs font-semibold text-white/60 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0084FF]/70 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Muat ulang
        </button>
      </div>

      {(loadError || feedback) && (
        <div
          role={loadError || feedback?.type === 'error' ? 'alert' : 'status'}
          className={`mt-4 rounded-2xl border px-4 py-3 text-xs leading-5 ${
            loadError || feedback?.type === 'error'
              ? 'border-red-400/20 bg-red-400/[0.07] text-red-100'
              : 'border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-100'
          }`}
        >
          {loadError || feedback?.message}
        </div>
      )}

      <form
        onSubmit={handleCreate}
        className="mt-5 grid gap-3 rounded-2xl border border-white/[0.07] bg-black/15 p-4 md:grid-cols-[minmax(0,1fr)_110px_auto_auto] md:items-end"
      >
        <label className="block text-[11px] font-medium text-white/55">
          Nama kelompok
          <input
            type="text"
            maxLength={100}
            value={createName}
            disabled={isMutating}
            placeholder="Contoh: Weekly Diamond Pass"
            onChange={event => setCreateName(event.target.value)}
            className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0b0e16] px-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-fuchsia-400/50 disabled:cursor-not-allowed disabled:opacity-45"
          />
        </label>

        <label className="block text-[11px] font-medium text-white/55">
          Urutan
          <input
            type="number"
            min="0"
            step="1"
            value={createSortOrder}
            disabled={isMutating}
            onChange={event => setCreateSortOrder(event.target.value)}
            className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0b0e16] px-3 font-mono text-sm text-white outline-none focus:border-fuchsia-400/50 disabled:cursor-not-allowed disabled:opacity-45"
          />
        </label>

        <Checkbox
          isSelected={createIsActive}
          isDisabled={isMutating}
          onChange={setCreateIsActive}
          className="min-h-11 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3"
        >
          Aktif
        </Checkbox>

        <button
          type="submit"
          disabled={isMutating || !createName.trim()}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-fuchsia-300/25 bg-fuchsia-400/[0.12] px-4 text-xs font-semibold text-fuchsia-100 transition-colors hover:bg-fuchsia-400/[0.2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/70 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isMutating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
          Buat kelompok
        </button>
      </form>

      <div className="mt-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
          Filter inventory
        </p>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
          <button
            type="button"
            onClick={() => onFilterChange('all')}
            className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0084FF]/70 ${
              activeFilter === 'all'
                ? 'border-[#0084FF]/35 bg-[#0084FF]/15 text-sky-100'
                : 'border-white/[0.08] bg-white/[0.025] text-white/50 hover:text-white'
            }`}
          >
            Semua · {totalCount}
          </button>
          <button
            type="button"
            onClick={() => onFilterChange('ungrouped')}
            className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70 ${
              activeFilter === 'ungrouped'
                ? 'border-amber-300/30 bg-amber-300/[0.1] text-amber-100'
                : 'border-white/[0.08] bg-white/[0.025] text-white/50 hover:text-white'
            }`}
          >
            Belum dikelompokkan · {ungroupedCount}
          </button>
          {groups.map(group => (
            <button
              key={group.ID}
              type="button"
              onClick={() => onFilterChange(group.ID)}
              className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300/70 ${
                activeFilter === group.ID
                  ? 'border-fuchsia-300/30 bg-fuchsia-400/[0.1] text-fuchsia-100'
                  : 'border-white/[0.08] bg-white/[0.025] text-white/50 hover:text-white'
              }`}
            >
              {group.name} · {groupProductCounts[group.ID] ?? 0}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {loading ? (
          <div className="flex min-h-24 items-center justify-center gap-2 rounded-2xl border border-white/[0.07] bg-black/10 text-xs text-white/40">
            <Loader2 size={16} className="animate-spin" />
            Memuat kelompok...
          </div>
        ) : groups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-8 text-center text-xs leading-5 text-white/40">
            Belum ada kelompok untuk katalog ini. Buat kelompok pertama di atas.
          </div>
        ) : (
          groups.map(group => {
            const productCount = groupProductCounts[group.ID] ?? 0
            const isEditing = editingGroupID === group.ID

            if (isEditing) {
              return (
                <form
                  key={group.ID}
                  onSubmit={event => void handleUpdate(event, group.ID)}
                  className="grid gap-3 rounded-2xl border border-fuchsia-300/20 bg-fuchsia-400/[0.055] p-4 md:grid-cols-[minmax(0,1fr)_110px_auto_auto] md:items-end"
                >
                  <label className="block text-[11px] font-medium text-white/55">
                    Nama kelompok
                    <input
                      type="text"
                      maxLength={100}
                      value={editName}
                      disabled={isMutating}
                      onChange={event => setEditName(event.target.value)}
                      className="mt-2 h-10 w-full rounded-xl border border-white/10 bg-[#0b0e16] px-3 text-sm text-white outline-none focus:border-fuchsia-400/50 disabled:opacity-45"
                    />
                  </label>
                  <label className="block text-[11px] font-medium text-white/55">
                    Urutan
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={editSortOrder}
                      disabled={isMutating}
                      onChange={event => setEditSortOrder(event.target.value)}
                      className="mt-2 h-10 w-full rounded-xl border border-white/10 bg-[#0b0e16] px-3 font-mono text-sm text-white outline-none focus:border-fuchsia-400/50 disabled:opacity-45"
                    />
                  </label>
                  <Checkbox
                    isSelected={editIsActive}
                    isDisabled={isMutating}
                    onChange={setEditIsActive}
                    className="min-h-10 rounded-xl border border-white/[0.07] bg-black/10 px-3"
                  >
                    Aktif
                  </Checkbox>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={isMutating}
                      onClick={cancelEditing}
                      aria-label={`Batal mengedit ${group.name}`}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-white/50 hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
                    >
                      <X size={15} />
                    </button>
                    <button
                      type="submit"
                      disabled={isMutating || !editName.trim()}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-fuchsia-300/25 bg-fuchsia-400/[0.14] px-3.5 text-xs font-semibold text-fuchsia-100 hover:bg-fuchsia-400/[0.22] disabled:opacity-40"
                    >
                      {isMutating ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      Simpan
                    </button>
                  </div>
                </form>
              )
            }

            return (
              <div
                key={group.ID}
                className="flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-black/10 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-white">
                      {group.name}
                    </h3>
                    <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] ${
                      group.is_active
                        ? 'border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-200'
                        : 'border-white/10 bg-white/[0.035] text-white/35'
                    }`}>
                      {group.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-[10px] text-white/35">
                    Urutan {group.sort_order} · {productCount} produk
                  </p>
                </div>

                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    disabled={isMutating}
                    onClick={() => beginEditing(group)}
                    className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-semibold text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0084FF]/70 disabled:opacity-40"
                  >
                    <Pencil size={13} /> Edit
                  </button>
                  <button
                    type="button"
                    disabled={isMutating}
                    onClick={() => void handleDelete(group)}
                    className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-red-400/15 bg-red-400/[0.045] px-3 text-xs font-semibold text-red-200/70 transition-colors hover:bg-red-400/[0.1] hover:text-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/70 disabled:opacity-40"
                  >
                    <Trash2 size={13} /> Hapus
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}
