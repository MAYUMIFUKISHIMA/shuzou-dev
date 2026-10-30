import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
  plugins: [
    VitePWA({
      registerType: "prompt",
      injectRegister: "auto",
      manifest: {
        name: "蔵の記録",
        short_name: "蔵の記録",
        lang: "ja",
        start_url: "/",
        display: "standalone",
        background_color: "#f5f5ee",
        theme_color: "#174c43",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallback: "index.html",
        cleanupOutdatedCaches: true,
        runtimeCaching: [],
      },
    }),
  ],
});
