'use client'

import { useCallback, useEffect, useState } from 'react'
import { useApi } from '@/hooks/useApi'
import type { Transaction, TransactionKpiSummary } from '../types'

const emptySummary: TransactionKpiSummary = {
  total_revenue: 0,
  total_profit: 0,
  success_count: 0,
  failed_count: 0,
  pending_count: 0,
  total_count: 0
}

export default function useTransactions () {
  const { get } = useApi()

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [summary, setSummary] = useState<TransactionKpiSummary>(emptySummary)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [dateFilter, setDateFilter] = useState('ALL')
  const [filterProvider, setFilterProvider] = useState('ALL')
  const [filterSource, setFilterSource] = useState('ALL')

  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)

  const itemsPerPage = 10

  const getDateRange = useCallback(() => {
    let start = ''
    let end = ''

    const getLocalDate = (d: Date) => {
      const local = new Date(d)
      local.setMinutes(d.getMinutes() - d.getTimezoneOffset())
      return local.toISOString().split('T')[0]
    }

    const today = new Date()

    if (dateFilter === 'TODAY') {
      start = getLocalDate(today)
      end = start
    } else if (dateFilter === 'YESTERDAY') {
      const y = new Date(today)
      y.setDate(y.getDate() - 1)
      start = getLocalDate(y)
      end = start
    } else if (dateFilter === '7DAYS') {
      const d7 = new Date(today)
      d7.setDate(d7.getDate() - 7)
      start = getLocalDate(d7)
      end = getLocalDate(today)
    } else if (dateFilter === 'THIS_MONTH') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      start = getLocalDate(firstDay)
      end = getLocalDate(lastDay)
    }

    return { start, end }
  }, [dateFilter])

  const buildTransactionParams = useCallback(
    (page: number, limit: number) => {
      const { start, end } = getDateRange()

      return new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search,
        status: filterStatus,
        provider: filterProvider,
        source: filterSource,
        start_date: start,
        end_date: end
      })
    },
    [filterProvider, filterSource, filterStatus, getDateRange, search]
  )

  const fetchTrx = useCallback(async () => {
    setLoading(true)

    try {
      const params = buildTransactionParams(currentPage, itemsPerPage)
      const res = await get(`/admin/transactions?${params.toString()}`)

      if (res.ok) {
        const data = await res.json()
        setTransactions(data.data || [])
        setSummary(data.summary || emptySummary)
        setTotalPages(data.meta?.total_pages || 1)
        setTotalItems(data.meta?.total || 0)
      }
    } catch (err) {
      console.error('Gagal load transaksi', err)
    } finally {
      setLoading(false)
    }
  }, [buildTransactionParams, get, currentPage])

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchTrx()
    }, 300)

    return () => clearTimeout(delayDebounceFn)
  }, [fetchTrx])

  useEffect(() => {
    setCurrentPage(1)
  }, [search, filterStatus, dateFilter, filterProvider, filterSource])

  const handlePageChange = (page: number) => setCurrentPage(page)

  const copyToClipboard = (text: string) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    alert('Berhasil disalin: ' + text)
  }

  const exportTransactionsCsv = useCallback(async () => {
    setExporting(true)

    try {
      const exportLimit = 100
      const firstParams = buildTransactionParams(1, exportLimit)
      const firstRes = await get(
        `/admin/transactions?${firstParams.toString()}`
      )

      if (!firstRes.ok) {
        alert('Gagal export transaksi.')
        return
      }

      const firstPayload = await firstRes.json()
      const allTransactions: Transaction[] = firstPayload.data || []
      const totalPagesToExport = firstPayload.meta?.total_pages || 1

      for (let page = 2; page <= totalPagesToExport; page += 1) {
        const params = buildTransactionParams(page, exportLimit)
        const res = await get(`/admin/transactions?${params.toString()}`)
        if (!res.ok) continue

        const payload = await res.json()
        allTransactions.push(...(payload.data || []))
      }

      if (allTransactions.length === 0) {
        alert('Tidak ada data transaksi untuk diexport.')
        return
      }

      downloadCsv(allTransactions)
    } catch (err) {
      console.error('Gagal export transaksi', err)
      alert('Gagal export transaksi.')
    } finally {
      setExporting(false)
    }
  }, [buildTransactionParams, get])

  return {
    loading,
    exporting,
    search,
    setSearch,
    filterStatus,
    setFilterStatus,
    dateFilter,
    setDateFilter,
    filterProvider,
    setFilterProvider,
    filterSource,
    setFilterSource,
    transactions,
    summary,
    currentPage,
    totalPages,
    totalItems,
    handlePageChange,
    fetchTrx,
    exportTransactionsCsv,
    copyToClipboard
  }
}

function downloadCsv (transactions: Transaction[]) {
  const headers = [
    'Invoice',
    'Created At',
    'Product',
    'Product SKU',
    'Target',
    'Amount',
    'Capital',
    'Profit',
    'Status',
    'Provider Status',
    'Payment Method',
    'Provider',
    'Provider SKU',
    'Provider Ref',
    'Source',
    'Actor',
    'SN / Log'
  ]

  const rows = transactions.map(trx => [
    trx.invoice_id,
    formatCsvDate(trx.CreatedAt),
    trx.Product?.name || '',
    trx.Product?.code || '',
    trx.customer_phone,
    trx.amount,
    trx.capital,
    trx.profit,
    trx.status,
    trx.digi_status,
    trx.payment_method,
    trx.provider_name || trx.provider,
    trx.provider_sku,
    trx.provider_ref,
    trx.created_via,
    trx.created_by_name || 'SYSTEM',
    trx.sn
  ])

  const csv = [headers, ...rows]
    .map(row => row.map(value => escapeCsvValue(value)).join(','))
    .join('\r\n')

  const blob = new Blob(['\uFEFF' + csv], {
    type: 'text/csv;charset=utf-8;'
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const stamp = new Date().toISOString().slice(0, 10)

  link.href = url
  link.download = `transactions-${stamp}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function escapeCsvValue (value: unknown) {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

function formatCsvDate (dateStr: string) {
  if (!dateStr) return ''

  return new Date(dateStr).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}
