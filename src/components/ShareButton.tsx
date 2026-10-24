import { useEffect, useRef, useState } from "react";
import { buildShareUrl } from "../services/persistence";
import type { SongChordItem } from "../types/chord";

interface ShareButtonProps {
  items: readonly SongChordItem[];
  title: string;
}

type ShareStatus = "idle" | "copied" | "manual";

export function ShareButton({ items, title }: ShareButtonProps) {
  const [status, setStatus] = useState<ShareStatus>("idle");
  const [url, setUrl] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status !== "copied") {
      return;
    }

    const timer = window.setTimeout(() => setStatus("idle"), 2200);
    return () => window.clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    if (status === "manual") {
      inputRef.current?.select();
    }
  }, [status]);

  async function handleShare() {
    const shareUrl = buildShareUrl(items, title);
    setUrl(shareUrl);

    try {
      await navigator.clipboard.writeText(shareUrl);
      setStatus("copied");
    } catch {
      // 剪貼簿不可用時，改顯示網址讓使用者手動複製。
      setStatus("manual");
    }
  }

  return (
    <div className="share-control">
      <button
        type="button"
        className="ghost-button"
        onClick={handleShare}
        disabled={items.length === 0}
      >
        {status === "copied" ? "✓ 已複製連結" : "複製分享連結"}
      </button>

      {status === "manual" && (
        <input
          ref={inputRef}
          className="share-control__url"
          type="text"
          readOnly
          value={url}
          aria-label="分享連結，請手動複製"
          onFocus={(event) => event.currentTarget.select()}
        />
      )}
    </div>
  );
}
