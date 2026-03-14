import { useState, useMemo } from 'react';

export const usePagination = ({ items, itemsPerPage = 10 }) => {
  const [currentPage, setCurrentPage] = useState(1);

  const paginationData = useMemo(() => {
    const totalPages = Math.ceil(items.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentItems = items.slice(startIndex, endIndex);

    return {
      currentPage,
      totalPages,
      currentItems,
      startIndex,
      endIndex,
      itemsPerPage,
    };
  }, [items, currentPage, itemsPerPage]);

  return {
    ...paginationData,
    setCurrentPage,
    goToNextPage: () => setCurrentPage((p) => Math.min(p + 1, paginationData.totalPages)),
    goToPrevPage: () => setCurrentPage((p) => Math.max(p - 1, 1)),
    goToPage: (page) => setCurrentPage(Math.max(1, Math.min(page, paginationData.totalPages))),
  };
};
