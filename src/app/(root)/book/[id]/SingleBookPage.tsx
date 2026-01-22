"use client";

import { BookDescr } from "@/components/BookDescr";
import { useGetBookById } from "@/hooks/useGetBookById";

export function SingleCategoryPage() {
  const { data, isLoading } = useGetBookById();

  if (isLoading) {
    return <div className="container">Loading..</div>;
  }

  return (
    <div>
      <div className="container">
        <BookDescr book={data?.data} />
      </div>
    </div>
  );
}
