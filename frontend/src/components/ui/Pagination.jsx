import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import clsx from 'clsx';

/**
 * Pagination - Page navigation component
 *
 * @param {Object} props
 * @param {number} props.currentPage - Current page number (1-indexed)
 * @param {number} props.totalPages - Total number of pages
 * @param {function} props.onPageChange - Callback: (page) => {}
 * @param {boolean} props.showFirstLast - Show first/last buttons (default: true)
 * @param {number} props.siblingCount - Number of page buttons on each side of current (default: 1)
 * @param {string} props.className - Additional classes
 *
 * @example
 * <Pagination
 *   currentPage={3}
 *   totalPages={10}
 *   onPageChange={(page) => setCurrentPage(page)}
 * />
 */
const Pagination = ({
  currentPage,
  totalPages,
  onPageChange,
  showFirstLast = true,
  siblingCount = 1,
  className = '',
}) => {
  // Generate page range with ellipsis
  const getPageNumbers = () => {
    const pages = [];
    const totalNumbers = siblingCount * 2 + 3; // siblings + current + first + last
    const totalBlocks = totalNumbers + 2; // + 2 ellipsis

    if (totalPages <= totalBlocks) {
      // Show all pages if total is small
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const leftSiblingIndex = Math.max(currentPage - siblingCount, 1);
    const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages);

    const shouldShowLeftEllipsis = leftSiblingIndex > 2;
    const shouldShowRightEllipsis = rightSiblingIndex < totalPages - 1;

    // Always show first page
    pages.push(1);

    // Left ellipsis
    if (shouldShowLeftEllipsis) {
      pages.push('ellipsis-left');
    }

    // Sibling pages
    for (let i = leftSiblingIndex; i <= rightSiblingIndex; i++) {
      if (i !== 1 && i !== totalPages) {
        pages.push(i);
      }
    }

    // Right ellipsis
    if (shouldShowRightEllipsis) {
      pages.push('ellipsis-right');
    }

    // Always show last page
    if (totalPages > 1) {
      pages.push(totalPages);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  // Handle page change
  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      onPageChange(page);
    }
  };

  // Disabled states
  const isFirstPage = currentPage === 1;
  const isLastPage = currentPage === totalPages;

  // Button base classes
  const buttonBaseClasses =
    't-small px-3 py-2 min-w-[40px] flex items-center justify-center rounded-md transition-colors focus-visible:outline-2 outline-accent';
  const buttonEnabledClasses = 'bg-surface-2 text-text-2 border border-border hover:bg-surface-1 hover:text-text-1';
  const buttonDisabledClasses = 'bg-surface-1 text-text-3 border border-border cursor-not-allowed';
  const buttonActiveClasses = 'bg-accent-fill text-white border border-accent-fill hover:bg-accent-fill-hover';

  return (
    <nav className={clsx('flex items-center justify-center gap-1 flex-wrap', className)} aria-label="Pagination">
      {/* First page button */}
      {showFirstLast && (
        <button
          type="button"
          onClick={() => handlePageChange(1)}
          disabled={isFirstPage}
          className={clsx(buttonBaseClasses, isFirstPage ? buttonDisabledClasses : buttonEnabledClasses)}
          aria-label="Go to first page"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>
      )}

      {/* Previous page button */}
      <button
        type="button"
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={isFirstPage}
        className={clsx(buttonBaseClasses, isFirstPage ? buttonDisabledClasses : buttonEnabledClasses)}
        aria-label="Go to previous page"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Page numbers */}
      {pageNumbers.map((page) => {
        // Render ellipsis
        if (typeof page === 'string' && page.startsWith('ellipsis')) {
          return (
            <span key={page} className="t-small px-3 py-2 text-text-3" aria-hidden="true">
              ...
            </span>
          );
        }

        // Render page number
        const isActive = page === currentPage;
        return (
          <button
            key={page}
            type="button"
            onClick={() => handlePageChange(page)}
            className={clsx(buttonBaseClasses, 'tnum', isActive ? buttonActiveClasses : buttonEnabledClasses)}
            aria-label={`Go to page ${page}`}
            aria-current={isActive ? 'page' : undefined}
          >
            {page}
          </button>
        );
      })}

      {/* Next page button */}
      <button
        type="button"
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={isLastPage}
        className={clsx(buttonBaseClasses, isLastPage ? buttonDisabledClasses : buttonEnabledClasses)}
        aria-label="Go to next page"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      {/* Last page button */}
      {showFirstLast && (
        <button
          type="button"
          onClick={() => handlePageChange(totalPages)}
          disabled={isLastPage}
          className={clsx(buttonBaseClasses, isLastPage ? buttonDisabledClasses : buttonEnabledClasses)}
          aria-label="Go to last page"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      )}
    </nav>
  );
};

export default Pagination;
