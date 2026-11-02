/** Resize an uploaded portrait before it enters IndexedDB or a backup. */
export async function portraitFileToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Image must be 10 MB or smaller.');
  if (typeof createImageBitmap !== 'function') throw new Error('This browser cannot resize images. Use a recent version of Android Chrome.');
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not process the portrait.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    if (dataUrl.length > 1_500_000) throw new Error('Compressed portrait is too large. Choose a smaller image.');
    return dataUrl;
  } finally {
    bitmap.close();
  }
}
