import { useSyncExternalStore } from 'react';

let notice: string | null = null;
const listeners = new Set<() => void>();

export function setNotice(value: string | null): void {
  notice = value;
  listeners.forEach((listener) => listener());
}

export function useNotice(): string | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => notice,
    () => null,
  );
}
