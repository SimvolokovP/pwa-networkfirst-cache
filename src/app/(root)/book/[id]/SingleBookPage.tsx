"use client";

import { useGetBookById } from "@/hooks/useGetBookById";

export function SingleCategoryPage() {
  const { data, isLoading } = useGetBookById();

  if (isLoading) {
    return <div className="container">Loading..</div>;
  }

  return (
    <div>
      <div className="container">{data?.data.saleInfo.buyLink}</div>
    </div>
  );
}
