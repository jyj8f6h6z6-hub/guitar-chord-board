import { useCallback, useEffect, useState } from "react";
import { createDefaultSong, createSong } from "../services/songModel";
import { loadLibrary, saveLibrary } from "../services/songStorage";
import type { Library } from "../services/songStorage";
import type { Song } from "../types/song";
import { createId } from "../utils/createId";

const UNDO_LIMIT = 60;
const COALESCE_MS = 1200;

interface State {
  library: Library;
  /** 從分享連結打開、尚未存入歌單的歌 */
  draft: Song | null;
  /** 目前這首歌的上一個版本（最舊在前） */
  undo: Song[];
  lastKey: string | null;
  lastTime: number;
}

export interface SongLibrary {
  song: Song;
  songs: readonly Song[];
  draft: Song | null;
  canUndo: boolean;
  saveFailed: boolean;
  /** coalesceKey 相同且間隔很短的連續修改（例如打字）會合併成一次復原 */
  updateSong: (change: (song: Song) => Song, coalesceKey?: string) => void;
  undo: () => void;
  selectSong: (id: string) => void;
  newSong: () => void;
  duplicateSong: () => void;
  deleteSong: () => void;
  importSongs: (songs: Song[]) => void;
  openDraft: (song: Song) => void;
  saveDraft: () => void;
  discardDraft: () => void;
}

function currentSaved(library: Library): Song {
  return library.songs.find((song) => song.id === library.currentId) ?? library.songs[0];
}

function init(): State {
  return { library: loadLibrary(), draft: null, undo: [], lastKey: null, lastTime: 0 };
}

export function useSongLibrary(): SongLibrary {
  const [state, setState] = useState<State>(init);
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    setSaveFailed(!saveLibrary(state.library));
  }, [state.library]);

  const song = state.draft ?? currentSaved(state.library);

  const updateSong = useCallback((change: (song: Song) => Song, coalesceKey?: string) => {
    setState((prev) => {
      const current = prev.draft ?? currentSaved(prev.library);
      const changed = change(current);

      if (changed === current) {
        return prev;
      }

      const next: Song = { ...changed, updatedAt: Date.now() };
      const now = Date.now();
      const canCoalesce =
        coalesceKey !== undefined &&
        prev.lastKey === coalesceKey &&
        now - prev.lastTime < COALESCE_MS &&
        prev.undo.length > 0;
      const undo = canCoalesce ? prev.undo : [...prev.undo, current].slice(-UNDO_LIMIT);

      if (prev.draft) {
        return { ...prev, draft: next, undo, lastKey: coalesceKey ?? null, lastTime: now };
      }

      return {
        ...prev,
        undo,
        lastKey: coalesceKey ?? null,
        lastTime: now,
        library: {
          ...prev.library,
          songs: prev.library.songs.map((entry) => (entry.id === current.id ? next : entry)),
        },
      };
    });
  }, []);

  const undo = useCallback(() => {
    setState((prev) => {
      const previous = prev.undo[prev.undo.length - 1];

      if (!previous) {
        return prev;
      }

      const rest = prev.undo.slice(0, -1);

      if (prev.draft) {
        return { ...prev, draft: previous, undo: rest, lastKey: null };
      }

      return {
        ...prev,
        undo: rest,
        lastKey: null,
        library: {
          ...prev.library,
          songs: prev.library.songs.map((entry) => (entry.id === previous.id ? previous : entry)),
        },
      };
    });
  }, []);

  const selectSong = useCallback((id: string) => {
    setState((prev) =>
      prev.library.songs.some((entry) => entry.id === id)
        ? { ...prev, draft: null, undo: [], lastKey: null, library: { ...prev.library, currentId: id } }
        : prev,
    );
  }, []);

  const newSong = useCallback(() => {
    const created = createDefaultSong();
    setState((prev) => ({
      ...prev,
      draft: null,
      undo: [],
      lastKey: null,
      library: { currentId: created.id, songs: [...prev.library.songs, created] },
    }));
  }, []);

  const duplicateSong = useCallback(() => {
    setState((prev) => {
      const source = prev.draft ?? currentSaved(prev.library);
      const copy: Song = {
        ...source,
        id: createId(),
        title: `${source.title || "未命名歌曲"} 副本`.slice(0, 60),
        updatedAt: Date.now(),
        lines: source.lines.map((line) => ({
          ...line,
          id: createId(),
          items: line.items.map((item) => ({ ...item, id: createId() })),
        })),
      };

      return {
        ...prev,
        draft: null,
        undo: [],
        lastKey: null,
        library: { currentId: copy.id, songs: [...prev.library.songs, copy] },
      };
    });
  }, []);

  const deleteSong = useCallback(() => {
    setState((prev) => {
      const remaining = prev.library.songs.filter((entry) => entry.id !== prev.library.currentId);
      const library: Library =
        remaining.length === 0
          ? (() => {
              const fresh = createDefaultSong();
              return { currentId: fresh.id, songs: [fresh] };
            })()
          : { currentId: remaining[0].id, songs: remaining };

      return { ...prev, draft: null, undo: [], lastKey: null, library };
    });
  }, []);

  const importSongs = useCallback((imported: Song[]) => {
    if (imported.length === 0) {
      return;
    }

    setState((prev) => ({
      ...prev,
      draft: null,
      undo: [],
      lastKey: null,
      library: {
        currentId: imported[0].id,
        songs: [...prev.library.songs, ...imported],
      },
    }));
  }, []);

  const openDraft = useCallback((shared: Song) => {
    setState((prev) => ({ ...prev, draft: shared, undo: [], lastKey: null }));
  }, []);

  const saveDraft = useCallback(() => {
    setState((prev) => {
      if (!prev.draft) {
        return prev;
      }

      const stored = createSong(prev.draft.title, prev.draft.lines, prev.draft.key, prev.draft.palette);
      return {
        ...prev,
        draft: null,
        undo: [],
        lastKey: null,
        library: { currentId: stored.id, songs: [...prev.library.songs, stored] },
      };
    });
  }, []);

  const discardDraft = useCallback(() => {
    setState((prev) => ({ ...prev, draft: null, undo: [], lastKey: null }));
  }, []);

  return {
    song,
    songs: state.library.songs,
    draft: state.draft,
    canUndo: state.undo.length > 0,
    saveFailed,
    updateSong,
    undo,
    selectSong,
    newSong,
    duplicateSong,
    deleteSong,
    importSongs,
    openDraft,
    saveDraft,
    discardDraft,
  };
}
