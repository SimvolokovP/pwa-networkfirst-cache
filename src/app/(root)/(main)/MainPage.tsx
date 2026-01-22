"use client";

import { BooksList } from "@/components/BooksList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGetBooks } from "@/hooks/useGetBooks";
import { usePWAStatus } from "next-pwa-pack";
import { useEffect, useState } from "react";

export function MainPage() {
  const [query, setQuery] = useState<string>("React");
  const { data, isLoading, refetch } = useGetBooks({ q: query });
  const { online } = usePWAStatus();

  useEffect(() => {
    if (!isLoading && data && online) {
      const timeoutId = setTimeout(() => {
        navigator.serviceWorker.controller?.postMessage({
          type: "CACHE_CURRENT_HTML",
          url: window.location.href,
          html: document.documentElement.outerHTML,
        });
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [data, isLoading, online]);

  useEffect(() => {
    if (isLoading) console.log(data);
  }, [isLoading, data]);

  if (isLoading) {
    return <div className="container">Loading..</div>;
  }

  return (
    <div className="container pt-4 pb-18.5 md:pb-0 md:pt-10">
      <div className="flex w-full justify-end mb-4 gap-2">
        <Input
          className="max-w-2xs"
          value={query}
          onChange={(field) => setQuery(field.target.value)}
        />
        <Button variant={"secondary"} onClick={() => refetch()}>
          Search
        </Button>
      </div>
      <BooksList books={data?.data.items} isLoading={isLoading} />
    </div>
  );
}
