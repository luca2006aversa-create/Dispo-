import { ImageResponse } from 'next/og';

/** Icône de l'app : un « ? » blanc penché sur fond orange flamme. */
export function appIcon(size: number) {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FF6B3D' }}>
        <div style={{ display: 'flex', color: '#fff', fontSize: size * 0.62, fontWeight: 800, transform: 'rotate(12deg)', marginTop: -size * 0.04 }}>?</div>
      </div>
    ),
    { width: size, height: size },
  );
}
