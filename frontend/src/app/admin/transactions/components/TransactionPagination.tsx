interface TransactionPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage?: number;
  onPageChange: (page: number) => void;
}

export default function TransactionPagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage = 10,
  onPageChange,
}: TransactionPaginationProps) {
  // Kalau data kosong, nggak usah nampilin pagination
  if (totalItems === 0) return null;

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;

  return (
    <div className="mt-auto flex items-center justify-between border-t border-white/[0.05] pt-4">
      <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
        Showing {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, totalItems)} of {totalItems}
      </span>

      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-4 py-2 bg-white/[0.02] hover:bg-white/[0.08] text-slate-300 hover:text-white rounded-xl text-[10px] font-bold uppercase tracking-widest border border-white/[0.05] hover:border-white/[0.15] disabled:opacity-30 disabled:hover:bg-white/[0.02] transition-all"
        >
          Prev
        </button>

        <div className="hidden md:flex gap-1 items-center px-2">
          {[...Array(totalPages)].map((_, i) => {
            const pageNum = i + 1;
            // Logic buat nampilin "..." kalau halamannya banyak
            if (
              totalPages > 5 &&
              Math.abs(currentPage - pageNum) > 1 &&
              pageNum !== 1 &&
              pageNum !== totalPages
            ) {
              if (Math.abs(currentPage - pageNum) === 2)
                return <span key={pageNum} className="text-slate-500 text-xs px-1">...</span>;
              return null;
            }
            return (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all flex items-center justify-center ${
                  currentPage === pageNum
                    ? "bg-[#E491C9]/20 text-[#E491C9] border border-[#E491C9]/30"
                    : "text-slate-400 hover:text-white hover:bg-white/10 border border-transparent"
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages || totalPages === 0}
          className="px-4 py-2 bg-white/[0.02] hover:bg-white/[0.08] text-slate-300 hover:text-white rounded-xl text-[10px] font-bold uppercase tracking-widest border border-white/[0.05] hover:border-white/[0.15] disabled:opacity-30 disabled:hover:bg-white/[0.02] transition-all"
        >
          Next
        </button>
      </div>
    </div>
  );
}