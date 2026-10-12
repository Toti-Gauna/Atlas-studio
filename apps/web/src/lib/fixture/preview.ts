/**
 * Preview controls for the P02 frontend preview (FIXTURE transport only).
 * They let reviewers inspect loading/empty/error/forbidden/offline states
 * without a backend. Removed together with the fixture transport in P04.
 */
export type ForcedState = "none" | "loading" | "empty" | "error" | "forbidden" | "offline";

export interface PreviewState {
  latencyMs: number;
  forced: ForcedState;
  localAdapterOnline: boolean;
}

type Listener = () => void;

function createStore(initial: PreviewState) {
  let state = initial;
  const listeners = new Set<Listener>();
  return {
    get: () => state,
    set(patch: Partial<PreviewState>) {
      state = { ...state, ...patch };
      listeners.forEach((l) => l());
    },
    subscribe(l: Listener) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

export const previewState = createStore({ latencyMs: 0, forced: "none", localAdapterOnline: true });
