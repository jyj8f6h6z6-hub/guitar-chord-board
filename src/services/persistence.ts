import { useSyncExternalStore } from "react";

const LEFT_HANDED_KEY = "guitar-chord-board:left-handed";

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // 私密瀏覽或儲存空間已滿時，保存功能靜默失效即可。
  }
}

/* 左手模式：小型外部 store，讓和弦圖不必層層傳遞 props。 */
const leftHandedListeners = new Set<() => void>();
let leftHandedValue = readStorage(LEFT_HANDED_KEY) === "1";

function subscribeLeftHanded(listener: () => void): () => void {
  leftHandedListeners.add(listener);
  return () => leftHandedListeners.delete(listener);
}

export function setLeftHanded(value: boolean): void {
  leftHandedValue = value;
  writeStorage(LEFT_HANDED_KEY, value ? "1" : "0");
  leftHandedListeners.forEach((listener) => listener());
}

export function useLeftHanded(): boolean {
  return useSyncExternalStore(
    subscribeLeftHanded,
    () => leftHandedValue,
    () => false,
  );
}
