"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { isApiError } from "@/lib/api";
import { ToastProvider } from "@/components/ui";
import { ThemeProvider } from "./theme";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: false,
            // Never retry authorization/validation errors; retry transient ones once.
            retry: (count, err) => (isApiError(err) && ["FORBIDDEN", "NOT_FOUND", "UNAUTHENTICATED", "VALIDATION"].includes(err.code) ? false : count < 1),
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <ToastProvider>{children}</ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
