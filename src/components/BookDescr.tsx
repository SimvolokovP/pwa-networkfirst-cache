import { Book } from "@/shared/types/book.types";
import Image from "next/image";

interface BookDescrProps {
  book?: Book | null;
}

export function BookDescr({ book }: BookDescrProps) {
  return (
    <>
      {book && (
        <div className="flex w-full gap-4 md:flex-row flex-col">
          <div className="bg-secondary p-2 shadow rounded-xl min-w-75 text-center flex flex-col gap-2 items-center">
            <div>
              <Image
                height={250}
                width={160}
                className="boxShadow rounded-xl block"
                src={
                  book?.volumeInfo.imageLinks?.thumbnail ||
                  "/book-placeholder.jpg"
                }
                alt={book?.volumeInfo.title}
              />
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="bg-secondary p-2 rounded-xl shadow">
              <a target="_blank" href={book.saleInfo.buyLink}>
                <h3 className="text-[24px]">{book?.volumeInfo.title}</h3>
              </a>
              <ul className="w-full text-left mb-2">
                {book &&
                  book.volumeInfo.authors?.map((author) => (
                    <li className="text-[16px]" key={author}>
                      {author}
                    </li>
                  ))}
              </ul>
              <p className="text-[16px]">{book?.volumeInfo.description}</p>
            </div>
            <div className="bg-secondary p-2 rounded-xl shadow">
              <ul className="w-full flex flex-wrap gap-4">
                <li className="flex items-center gap-2">
                  <div className="text-[14px] font-bold">Дата публикации:</div>
                  <div className="text-[14px]">
                    {book?.volumeInfo.publishedDate}
                  </div>
                </li>
                <li className="flex items-center gap-2">
                  <div className="text-[14px] font-bold">
                    Количество страниц:
                  </div>
                  <div className="text-[14px]">
                    {book?.volumeInfo.pageCount}
                  </div>
                </li>
                <li className="flex items-center gap-2">
                  <div className="text-[14px] font-bold">Издатель:</div>
                  <div className="text-[14px]">
                    {book?.volumeInfo.publisher}
                  </div>
                </li>
                <li className="flex items-center gap-2">
                  <div className="text-[14px] font-bold">Язык:</div>
                  <div className="text-[14px]">{book?.volumeInfo.language}</div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
