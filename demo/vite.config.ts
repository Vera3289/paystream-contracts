import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    // Stellar SDK uses Buffer
    global: "globalThis",
  },
});
