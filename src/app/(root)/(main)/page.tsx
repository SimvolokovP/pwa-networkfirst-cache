import { Metadata } from "next";
import { MainPage } from "./MainPage";

export const metadata: Metadata = {
  title: "Main",
};

export default function Page() {
  return <MainPage />;
}