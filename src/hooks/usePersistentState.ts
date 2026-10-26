import { useCallback, useState } from "react";

type Widen<T> = T extends string ? string : T extends number ? number : T extends boolean ? boolean : never;

/** 把簡單的偏好設定（數字、布林、字串）存在瀏覽器，存取失敗時退回預設值。 */
export function usePersistentState<T extends string | number | boolean>(
  key: string,
  defaultValue: T,
): [Widen<T>, (value: Widen<T>) => void] {
  const [value, setValue] = useState<Widen<T>>(() => {
    try {
      const stored = window.localStorage.getItem(key);

      if (stored === null) {
        return defaultValue as unknown as Widen<T>;
      }

      const parsed = JSON.parse(stored) as unknown;
      return (typeof parsed === typeof defaultValue ? parsed : defaultValue) as Widen<T>;
    } catch {
      return defaultValue as unknown as Widen<T>;
    }
  });

  const update = useCallback(
    (next: Widen<T>) => {
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
