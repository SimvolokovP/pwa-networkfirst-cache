"use client";

import { categoriesService } from "@/services/category.service";
import { useQuery } from "@tanstack/react-query";

export function useGetCategories() {
  const postsQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => categoriesService.getAll(),

    retry: 1,

    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

    networkMode: "offlineFirst",
  });

  return {
    data: postsQuery.data,
    isSuccess: postsQuery.isSuccess,
    isLoading: postsQuery.isLoading,
    error: postsQuery.error,
    isFetching: postsQuery.isFetching,
  };
}
