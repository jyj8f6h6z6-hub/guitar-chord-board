export interface ScorePage {
  id: string;
  name: string;
  pageNumber: number;
  dataUrl: string;
  width: number;
  height: number;
}

export interface ScoreBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScoreChordMark {
  id: string;
  pageIndex: number;
  sourceText: string;
  sourceSymbol: string;
  symbol: string;
  confidence: number;
  bbox: ScoreBoundingBox;
  manual?: boolean;
}

export interface ScoreRecognitionProgress {
  pageIndex: number;
  pageCount: number;
  status: string;
  progress: number;
}
