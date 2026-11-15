/**
 * Shrink a picked photo before storing or uploading it: phones produce
 * 4–12 MB images, a receipt or avatar needs ~100 KB.
 */
export async function compressImage(file: File, maxSide = 1000, quality = 0.72): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Yalnız şəkil faylı seçin (JPG, PNG, HEIC).");
  if (file.size > 15 * 1024 * 1024) throw new Error("Şəkil çox böyükdür (maksimum 15 MB).");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("Şəkli açmaq olmadı. Başqa fayl seçin."));
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}
