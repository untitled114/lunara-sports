import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

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
  className = ''
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
  const buttonBaseClasses = 'px-3 py-2 min-w-[40px] flex items-center justify-center rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500';
  const buttonEnabledClasses = 'bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700 hover:text-white';
  const buttonDisabledClasses = 'bg-gray-900 text-gray-600 border border-gray-800 cursor-not-allowed';
  const buttonActiveClasses = 'bg-indigo-600 text-white border border-indigo-500 hover:bg-indigo-700';

  return (
    <nav
      className={`flex items-center justify-center gap-1 flex-wrap ${className}`}
      aria-label="Pagination"
    >
      {/* First page button */}
      {showFirstLast && (
        <button
          type="button"
          onClick={() => handlePageChange(1)}
          disabled={isFirstPage}
          className={`${buttonBaseClasses} ${isFirstPage ? buttonDisabledClasses : buttonEnabledClasses}`}
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
        className={`${buttonBaseClasses} ${isFirstPage ? buttonDisabledClasses : buttonEnabledClasses}`}
        aria-label="Go to previous page"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Page numbers */}
      {pageNumbers.map((page, index) => {
        // Render ellipsis
        if (typeof page === 'string' && page.startsWith('ellipsis')) {
          return (
            <span
              key={page}
              className="px-3 py-2 text-gray-500"
              aria-hidden="true"
            >
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
            className={`${buttonBaseClasses} ${isActive ? buttonActiveClasses : buttonEnabledClasses}`}
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
        className={`${buttonBaseClasses} ${isLastPage ? buttonDisabledClasses : buttonEnabledClasses}`}
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
          className={`${buttonBaseClasses} ${isLastPage ? buttonDisabledClasses : buttonEnabledClasses}`}
          aria-label="Go to last page"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      )}
    </nav>
  );
};

export default Pagination;
