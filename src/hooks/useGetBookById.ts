"use client";

import { bookService } from "@/services/book.service";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

export function useGetBookById() {
  const { id } = useParams<{ id: string }>();

  const postsQuery = useQuery({
    queryKey: ["book", id],
    queryFn: () => bookService.getBookById(id),
  });

  return {
    data: postsQuery.data,
    isSuccess: postsQuery.isSuccess,
    isLoading: postsQuery.isLoading,
  };
}
