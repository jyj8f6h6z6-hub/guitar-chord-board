import { normalizeChordName } from "../utils/normalizeChordName";

export function parseChordInput(input: string): string[] {
  return input
    .split(/[\s,，、|]+/)
    .map(normalizeChordName)
    .filter(Boolean);
}

export function uniqueChordSymbols(symbols: string[]): string[] {
  return [...new Set(symbols)];
}
