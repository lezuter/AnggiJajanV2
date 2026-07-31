'use client'

import { useState, type ReactNode } from 'react'
import { useDrawer } from '@/components/AdminTemplate'
import useTransactions from './hooks/useTransactions'
import TransactionToolbar from './components/TransactionToolbar'
import TransactionTable from './components/TransactionTable'
import TransactionPagination from './components/TransactionPagination'
import TransactionKPI from './components/TransactionKPI'
import TransactionDetailDrawer from './components/TransactionDetailDrawer'
import type { Transaction } from './types'

const CardBase = ({
  children,
  className = ''
}: {
  children: ReactNode
  className?: string
}) => (
  <div
    className={`relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.018] shadow-[0_8px_28px_rgba(0,0,0,0.14)] backdrop-blur-[80px] ${className}`}
  >
    <div className='absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.14] to-transparent opacity-40' />
    <div className='relative z-10 flex h-full flex-col'>{children}</div>
  </div>
)

export default function TransactionsPage () {
  const {
    loading,
    exporting,
    summary,
    search,
    setSearch,
    filterStatus,
    setFilterStatus,
    transactions,
    currentPage,
    totalPages,
    totalItems,
    dateFilter,
    setDateFilter,
    filterProvider,
    setFilterProvider,
    filterSource,
    setFilterSource,
    handlePageChange,
    fetchTrx,
    exportTransactionsCsv,
    copyToClipboard
  } = useTransactions()

  const [selectedTrx, setSelectedTrx] = useState<Transaction | null>(null)
  const { isDrawerOpen, setIsDrawerOpen } = useDrawer()

  const handleRowClick = (trx: Transaction) => {
    setSelectedTrx(trx)
    setIsDrawerOpen(true)
  }

  const closeDrawer = () => {
    setIsDrawerOpen(false)
    setTimeout(() => setSelectedTrx(null), 300)
  }

  return (
    <div className='mx-auto min-h-screen w-full max-w-[1920px] pb-10'>
      <div className='mb-8'>
        <h1 className='flex items-center gap-3 text-3xl font-black uppercase tracking-tight text-white'>
          <span className='h-8 w-2 rounded-full bg-gradient-to-b from-[#e491c9] to-purple-600' />
          Riwayat Transaksi
        </h1>
        <p className='ml-5 mt-1 text-[10px] font-bold uppercase tracking-widest text-purple-300/70'>
          Pantau semua orderan secara real-time.
        </p>

        <TransactionKPI summary={summary} />
      </div>

      <TransactionToolbar
        search={search}
        onSearchChange={setSearch}
        filterStatus={filterStatus}
        onFilterChange={setFilterStatus}
        loading={loading}
        onRefresh={fetchTrx}
        exporting={exporting}
        onExport={exportTransactionsCsv}
        totalTransactions={totalItems}
        dateFilter={dateFilter}
        onDateChange={setDateFilter}
        filterProvider={filterProvider}
        onProviderChange={setFilterProvider}
        filterSource={filterSource}
        onSourceChange={setFilterSource}
      />

      <CardBase className='flex min-h-[500px] flex-col p-4 md:p-6'>
        <div className='flex-grow'>
          <TransactionTable
            loading={loading}
            currentItems={transactions}
            search={search}
            copyToClipboard={copyToClipboard}
            onRowClick={handleRowClick}
          />
        </div>

        <div className='mt-auto'>
          <TransactionPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            onPageChange={handlePageChange}
          />
        </div>
      </CardBase>

      <TransactionDetailDrawer
        isOpen={isDrawerOpen}
        onClose={closeDrawer}
        transaction={selectedTrx}
        copyToClipboard={copyToClipboard}
        onRefresh={fetchTrx}
      />
    </div>
  )
}
