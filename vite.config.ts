import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const repositoryName = "guitar-chord-board";

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === "build" ? `/${repositoryName}/` : "/",
}));
