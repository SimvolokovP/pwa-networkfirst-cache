"use client";

import { usePWAStatus } from "next-pwa-pack";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

export function ConnectivityListener() {
  const isFirstRender = useRef(true);

  const { online } = usePWAStatus();

  useEffect(() => {
    const handleOnline = () => {
      toast.success("Соединение восстановлено", {
        description: "Вы снова в сети. Данные синхронизированы.",
        duration: 4000,
      });
    };

    const handleOffline = () => {
      toast.error("Отсутствует интернет", {
        description: "Приложение работает в автономном режиме.",
        duration: Infinity, // Оставляем висеть, пока не появится сеть
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Проверка при загрузке: если пользователь СРАЗУ зашел оффлайн
    if (!online && isFirstRender.current) {
      handleOffline();
    }

    isFirstRender.current = false;

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [online]);

  return null;
}
