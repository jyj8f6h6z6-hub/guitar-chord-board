import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const repositoryName = "guitar-chord-board";

export default defineConfig(({ command, isPreview }) => ({
  plugins: [react()],
  base: command === "build" || isPreview ? `/${repositoryName}/` : "/",
}));
