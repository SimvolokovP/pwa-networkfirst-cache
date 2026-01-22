import { Metadata } from "next";
import { SingleCategoryPage } from "./SingleBookPage";

export const metadata: Metadata = {
  title: "Category",
};

export default function Page() {
  return <SingleCategoryPage />;
}