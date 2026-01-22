"use client";

import { bookService, GetBooksParams } from "@/services/book.service";
import { useQuery } from "@tanstack/react-query";

export function useGetBooks({ q }: GetBooksParams) {
  const booksQuery = useQuery({
    queryKey: ["books"],
    queryFn: () => bookService.getBooks({ q }),

    retry: 1,

    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

    networkMode: "offlineFirst",
  });

  return {
    data: booksQuery.data,
    isSuccess: booksQuery.isSuccess,
    isLoading: booksQuery.isLoading,
    error: booksQuery.error,
    isFetching: booksQuery.isFetching,
    refetch: booksQuery.refetch
  };
}
