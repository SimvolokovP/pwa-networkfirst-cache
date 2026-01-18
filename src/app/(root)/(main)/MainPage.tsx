"use client";

import { useGetCategories } from "@/hooks/useGetCategories";
import Link from "next/link";

export function MainPage() {
  const { data, isLoading } = useGetCategories();

  if (isLoading) {
    return <div className="container">Loading..</div>;
  }

  return (
    <main>
      <div className="container">
        <Link href={"/about"}>
          ABOUT
        </Link>
        <Link href={"/cart"}>
          CART
        </Link>
        <div className="grid grid-cols-3 mt-8">
          {data?.map((item) => (
            <div key={item.id}>
              <Link href={`/category/${item.id}`}>
                <div>{item.name}</div>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
