/** Compress + resize an image client-side before upload or AI analysis.
 *  Returns compressed JPEG File, data URL, and raw base64. */
export async function compressImage(
  file: File,
  maxDim = 900,
  quality = 0.82,
): Promise<{ file: File; dataUrl: string; base64: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width >= height) {
          height = Math.round((height / width) * maxDim);
          width = maxDim;
        } else {
          width = Math.round((width / height) * maxDim);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas unavailable')); return; }
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('Compression failed')); return; }
        const compressed = new File([blob], 'product.jpg', { type: 'image/jpeg' });
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          resolve({ file: compressed, dataUrl, base64: dataUrl.split(',')[1] });
        };
        reader.onerror = () => reject(new Error('FileReader failed'));
        reader.readAsDataURL(blob);
      }, 'image/jpeg', quality);
    };

    img.onerror = () => reject(new Error('Image load failed'));
    img.src = objectUrl;
  });
}
