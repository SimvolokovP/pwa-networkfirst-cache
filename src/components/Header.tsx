"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Header() {
  const pathname = usePathname();

  return (
    <header className="p-2 border-b-border border-2">
      <div className="container">
        <div className="flex w-full justify-between items-center">
          <h3 className="text-2xl">PWA Cache Test</h3>
          <nav>
            <ul className="flex items-center gap-2">
              <li>
                <Link
                  className={`${pathname === "/" ? "underline" : ""}`}
                  href={"/"}
                >
                  Главная
                </Link>
              </li>
              <li>
                <Link
                  className={`${pathname === "/about" ? "underline" : ""}`}
                  href={"/about"}
                >
                  О нас
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </header>
  );
}
