"use client";

import { BooksList } from "@/components/BooksList";
import { useGetBooks } from "@/hooks/useGetBooks";
import { usePWAStatus } from "next-pwa-pack";
import { useEffect, useState } from "react";

export function MainPage() {
  const [query, setQuery] = useState<string>("Football");
  const { data, isLoading, refetch } = useGetBooks({ q: query });
  const { online } = usePWAStatus();

  useEffect(() => {
    if (isLoading) console.log(data);
  }, [isLoading, data]);

  if (isLoading) {
    return <div className="container">Loading..</div>;
  }

  return (
    <main>
      <div className="container relative pt-0 pb-[74px] md:pb-0 md:pt-[40px]">
        <div className="text-center w-full mb-6">
          {online ? "ONLINE" : "OFFLINE"}
          <input
            value={query}
            onChange={(field) => setQuery(field.target.value)}
          />
          <button onClick={() => refetch()}>refetch</button>
        </div>
        <BooksList books={data?.data.items} isLoading={isLoading} />
      </div>
    </main>
  );
}
