import { api } from "@/api/api";
import { Book, BooksResponse } from "@/shared/types/book.types";
import { AxiosResponse } from "axios";

export interface GetBooksParams {
  q: string;
  filter?: string | null;
  startIndex?: number;
  maxResults?: number;
}

class BookService {
  async getBooks({
    q,
    filter = "full",
    maxResults = 16,
    startIndex = 0,
  }: GetBooksParams): Promise<AxiosResponse<BooksResponse>> {
    console.log(startIndex);
    return api.get("/volumes", {
      params: {
        q,
        startIndex,
        filter,
        maxResults,
      },
    });
  }
  async getBookById(bookId: string): Promise<AxiosResponse<Book>> {
    return api.get(`/volumes/${bookId}`);
  }
}

export const bookService = new BookService();
