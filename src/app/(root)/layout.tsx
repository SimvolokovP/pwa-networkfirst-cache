import { Header } from "@/components/Header";
import type { PropsWithChildren } from "react";

export default function Layout({ children }: PropsWithChildren) {
  return (
    <>
      <Header />
      <main className="pt-4 md:pt-8 pb-8">{children}</main>
    </>
  );
}