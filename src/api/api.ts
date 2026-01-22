import axios from "axios";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL;

export const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY;

export const api = axios.create({
  baseURL: BASE_URL,
  params: {
    key: API_KEY,
  },
});
