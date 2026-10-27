import { useCallback, useState } from "react";

/** 把簡單的偏好設定（數字、布林、字串）存在瀏覽器，存取失敗時退回預設值。 */
export function usePersistentState<T extends string | number | boolean>(
  key: string,
  defaultValue: T,
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(key);

      if (stored === null) {
        return defaultValue;
      }

      const parsed = JSON.parse(stored) as unknown;
      return (typeof parsed === typeof defaultValue ? parsed : defaultValue) as T;
    } catch {
      return defaultValue;
    }
  });

  const update = useCallback(
    (next: T) => {
      setValue(next);

      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // 儲存失敗不影響目前畫面。
      }
    },
    [key],
  );

  return [value, update];
}
