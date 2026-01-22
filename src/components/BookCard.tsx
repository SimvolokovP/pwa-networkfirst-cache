import { Book } from "@/shared/types/book.types";
import Image from "next/image";
import Link from "next/link";
import { Card, CardAction, CardHeader } from "./ui/card";

interface BookCardProps {
  book: Book;
}

export function BookCard({ book }: BookCardProps) {
  return (
    <Card className="relative bg-secondary rounded-xl h-full shadow flex flex-col justify-between">
      <CardHeader>
        <div className="truncate">{book.volumeInfo.title}</div>
      </CardHeader>
      <div className="flex w-full justify-center">
        <Image
          height={180}
          width={120}
          className="boxShadow rounded-xl"
          src={
            book.volumeInfo.imageLinks?.smallThumbnail ||
            "/book-placeholder.jpg"
          }
          loading="eager"
          alt={book.volumeInfo.title}
        />
      </div>
      <CardAction className="w-full">
        <div className="w-full flex justify-between items-center px-2">
          <div>{book.accessInfo.country}</div>
          <Link className="font-bold" href={`/book/${book.id}`}>
            Подробнее
          </Link>
        </div>
      </CardAction>
    </Card>
  );
}
