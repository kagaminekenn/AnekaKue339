import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
}

const Pagination = ({
  currentPage,
  totalItems,
  pageSize = 10,
  onPageChange
}: PaginationProps) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  if (totalItems <= pageSize) {
    return null;
  }

  const goToPrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const goToNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  const getVisiblePages = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages] as const;
    }

    if (currentPage >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages] as const;
    }

    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages] as const;
  };

  const visiblePages = getVisiblePages();

  return (
    <div className="flex flex-col gap-3 border-t border-cyan-100 bg-gradient-to-r from-slate-50 to-cyan-50/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-600">
        Page {currentPage} of {totalPages}
      </p>
      <div className="flex items-center gap-2 self-end sm:self-auto">
        <button
          type="button"
          onClick={goToPrevious}
          disabled={currentPage === 1}
          aria-label="Go to previous page"
          className="cursor-pointer rounded-lg border border-cyan-200 bg-white p-2 text-cyan-800 transition-colors hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-1">
          {visiblePages.map((page, index) => {
            if (page === '...') {
              return (
                <span key={`ellipsis-${index}`} className="px-2 text-sm text-slate-500">
                  ...
                </span>
              );
            }

            const isActive = page === currentPage;

            return (
              <button
                key={page}
                type="button"
                onClick={() => onPageChange(page)}
                aria-label={`Go to page ${page}`}
                className={`min-w-8 cursor-pointer rounded-lg border px-2 py-1.5 text-sm transition-colors ${
                  isActive
                    ? 'border-cyan-700 bg-cyan-700 text-white'
                    : 'border-cyan-200 bg-white text-slate-700 hover:bg-cyan-50'
                }`}
              >
                {page}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={goToNext}
          disabled={currentPage === totalPages}
          aria-label="Go to next page"
          className="cursor-pointer rounded-lg border border-cyan-200 bg-white p-2 text-cyan-800 transition-colors hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
