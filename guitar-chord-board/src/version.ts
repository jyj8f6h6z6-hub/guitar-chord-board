import packageJson from "../package.json";

/** 完整版號，例如 1.3.0-exp.1 */
export const APP_VERSION: string = packageJson.version;

/** 試驗版（版號含 -exp.N）才有標示，例如 "Experimental 1"；正式版回傳 null。 */
export function experimentalLabel(version: string = APP_VERSION): string | null {
  const match = version.match(/-exp\.(\d+)$/);
  return match ? `Experimental ${match[1]}` : null;
}
