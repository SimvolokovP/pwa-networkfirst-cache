import { Metadata } from "next";
import { SingleCategoryPage } from "./SingleCategoryPage";

export const metadata: Metadata = {
  title: "Category",
};

export default function Page() {
  return <SingleCategoryPage />;
}