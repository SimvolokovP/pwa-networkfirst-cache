import { Metadata } from "next";
import { MainPage } from "./MainPage";

export const metadata: Metadata = {
  title: "About",
};

export default function Page() {
  return <MainPage />;
}