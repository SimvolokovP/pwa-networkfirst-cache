import { Book } from "@/shared/types/book.types";
import { BookCard } from "./BookCard";

interface BooksListProps {
  books?: Book[];
  isLoading?: boolean;
}

export function BooksList({ books, isLoading = false }: BooksListProps) {
  const hasBooks = books && books.length > 0 && !isLoading;

  return (
    <div>
      {hasBooks ? (
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-1.5">
          {books.map((book) => (
            <li key={book.id}>
              <BookCard book={book} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-center text-[24px] p-2">Здесь ничего нет</div>
      )}
    </div>
  );
}
