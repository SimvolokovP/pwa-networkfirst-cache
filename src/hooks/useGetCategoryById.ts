// "use client";

// import { categoriesService } from "@/services/category.service";
// import { useQuery } from "@tanstack/react-query";
// import { useParams } from "next/navigation";

// export function useGetCategoryById() {
//   const { id } = useParams<{ id: string }>();

//   const postsQuery = useQuery({
//     queryKey: ["category", id],
//     queryFn: () => categoriesService.getById(+id),
//   });

//   return {
//     data: postsQuery.data,
//     isSuccess: postsQuery.isSuccess,
//     isLoading: postsQuery.isLoading,
//   };
// }
