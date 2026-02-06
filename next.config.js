/** @type {import('next').NextConfig} */
const nextConfig = {
  // WICHTIG: StrictMode deaktivieren für PixiJS
  // StrictMode verursacht doppelte Initialisierung, was zu Problemen mit WebGL führt
  reactStrictMode: false,

  // Konva.js und react-konva funktionieren nur im Browser,
  // daher müssen wir sie als externe Module markieren
  webpack: (config, { isServer }) => {
    // Auf der Server-Seite: canvas-Modul als extern markieren
    if (isServer) {
      config.externals = [...(config.externals || []), 'canvas', 'konva'];
    }

    // Auf der Client-Seite: canvas als false (nicht benötigt)
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
      };
    }

    return config;
  },

  // Transpiliere react-konva und konva für bessere Kompatibilität
  transpilePackages: ['react-konva', 'konva'],
};

module.exports = nextConfig;
