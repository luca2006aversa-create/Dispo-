// Compression des photos dans le navigateur avant l'envoi.

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image illisible')); };
    img.src = url;
  });
}

/** Réduit l'image (côté long `maxSide` px) en JPEG, en baissant la qualité jusqu'à passer sous `maxBytes`. */
export async function compressImage(file: File, maxSide = 1600, maxBytes = 450_000): Promise<Blob> {
  const img = await loadImage(file);
  let side = maxSide;
  let quality = 0.82;
  let out: Blob | null = null;
  for (let i = 0; i < 6; i++) {
    const scale = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    out = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', quality));
    if (out && out.size <= maxBytes) break;
    side = Math.round(side * 0.85);
    quality = Math.max(0.55, quality - 0.07);
  }
  if (!out) throw new Error('compression impossible');
  return out;
}
