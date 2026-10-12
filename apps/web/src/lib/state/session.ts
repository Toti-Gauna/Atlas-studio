"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session, WorkspaceRole } from "@atlas/contracts";
import { api, isApiError } from "@/lib/api";
import { setCsrfToken } from "@/lib/api/http";
import { setDisplayTimeZone } from "@/lib/format";
import { can, type Action } from "@atlas/domain";

export function useSession() {
  return useQuery<Session>({
    queryKey: ["session"],
    queryFn: async () => {
      const s = await api.auth.session();
      setCsrfToken(s.csrfToken);
      setDisplayTimeZone(s.workspace.timeZone);
      return s;
    },
    retry: (n, e) => !(isApiError(e) && e.code === "UNAUTHENTICATED") && n < 1,
    staleTime: 60_000,
  });
}

/** UI hint only — the server re-checks every action. */
export function useCan(action: Action): boolean {
  const { data } = useSession();
  return data ? can(data.role, action) : false;
}

export function useStartDemo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (role?: WorkspaceRole) => api.demo.start(role),
    onSuccess: (s) => {
      setCsrfToken(s.csrfToken);
      setDisplayTimeZone(s.workspace.timeZone);
      qc.setQueryData(["session"], s);
      void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "session" });
    },
  });
}

export function useSwitchRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (role: WorkspaceRole) => api.demo.switchRole(role),
    onSuccess: (s) => {
      setCsrfToken(s.csrfToken);
      qc.setQueryData(["session"], s);
      void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "session" });
    },
  });
}
