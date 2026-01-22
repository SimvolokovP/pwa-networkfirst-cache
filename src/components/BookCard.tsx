import { getShortText } from "@/helpers/getShortText";
import { Book } from "@/shared/types/book.types";
import Image from "next/image";
import Link from "next/link";

interface BookCardProps {
  book: Book;
}

export function BookCard({ book }: BookCardProps) {
  return (
    <article className="relative bg-secondary p-[8px] rounded-xl h-full shadow flex flex-col">
      <h3 className="w-full text-left mb-[16px] max-w-[270px]">
        {book.volumeInfo.title}
      </h3>
      <div className="flex w-full justify-center">
        <Image
        
          height={180}
          width={120}
          className="boxShadow rounded-xl h-[180px] mb-[16px]"
          src={
            book.volumeInfo.imageLinks?.smallThumbnail ||
            "/book-placeholder.jpg"
          }
          loading="eager"
          alt={book.volumeInfo.title}
        />
      </div>
      <ul className="w-full text-left mb-[8px] flex flex-wrap gap-[8px]">
        {book.volumeInfo.authors?.map((author) => (
          <li className="underline" key={author}>
            {author}
          </li>
        ))}
      </ul>
      <p className="w-full text-left text-[15px]">
        {book.volumeInfo.description &&
          getShortText(book.volumeInfo.description, 72)}
        <Link className="font-bold" href={`/book/${book.id}`}>
          Подробнее
        </Link>
      </p>
    </article>
  );
}
