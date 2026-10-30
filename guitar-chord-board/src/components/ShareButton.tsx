import { useEffect, useRef, useState } from "react";
import { buildShareUrl, encodeShareToken, isShareTokenTooLong } from "../services/songStorage";
import { countItems } from "../services/songModel";
import type { Song } from "../types/song";

interface ShareButtonProps {
  song: Song;
}

type ShareStatus = "idle" | "copied" | "manual" | "error";

export function ShareButton({ song }: ShareButtonProps) {
  const [status, setStatus] = useState<ShareStatus>("idle");
  const [url, setUrl] = useState("");
  const [tooLong, setTooLong] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isEmpty = countItems(song) === 0;

  useEffect(() => {
    if (status !== "copied") return;
    const timer = window.setTimeout(() => setStatus("idle"), 2200);
    return () => window.clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    if (status === "manual") inputRef.current?.select();
  }, [status]);

  async function handleShare() {
    try {
      const token = await encodeShareToken(song);
      const shareUrl = buildShareUrl(token);
      setUrl(shareUrl);
      setTooLong(isShareTokenTooLong(token));

      try {
        await navigator.clipboard.writeText(shareUrl);
        setStatus("copied");
      } catch {
        setStatus("manual");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="share-control">
      <button type="button" className="ghost-button" onClick={handleShare} disabled={isEmpty}>
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

      {status === "error" && <small className="share-control__warning">產生連結失敗，請改用「匯出」檔案分享。</small>}

      {tooLong && status !== "error" && (
        <small className="share-control__warning">
          連結很長，部分通訊軟體可能會截斷；建議改用「匯出」檔案分享。
        </small>
      )}
    </div>
  );
}
