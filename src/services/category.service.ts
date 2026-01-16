import { api } from "@/api/api";
import { Category } from "@/shared/types/category.types";

class CategoriesService {
  async getAll() {
    const response = await api.get<Category[]>("/categories");

    return response.data;
  }

  async getById(id: number) {
    const response = await api.get<Category>(`/categories/${id}`);

    return response.data;
  }
}

export const categoriesService = new CategoriesService();
