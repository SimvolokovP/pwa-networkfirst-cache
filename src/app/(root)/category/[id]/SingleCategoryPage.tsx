"use client";

import { useGetCategoryById } from "@/hooks/useGetCategoryById";

export function SingleCategoryPage() {
  const { data, isLoading } = useGetCategoryById();

  if (isLoading) {
    return <div className="container">Loading..</div>;
  }

  return (
    <main>
      <div className="container">{data?.name}</div>
    </main>
  );
}
