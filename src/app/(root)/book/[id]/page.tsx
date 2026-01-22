import { Metadata } from "next";
import { SingleCategoryPage } from "./SingleBookPage";

export const metadata: Metadata = {
  title: "Book",
};

export default function Page() {
  return <SingleCategoryPage />;
}