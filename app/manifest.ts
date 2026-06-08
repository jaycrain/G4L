import type { MetadataRoute } from 'next';

// Served at /manifest.webmanifest (Next auto-injects <link rel="manifest">). `display: standalone`
// is what makes an installed G4L launch in its own window — no browser URL bar.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Grinta for Life',
    short_name: 'G4L',
    description: 'Reclaim your identity. Measured by the ID Score.',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#374f63',
    categories: ['health', 'lifestyle', 'medical'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
