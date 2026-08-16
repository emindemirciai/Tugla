/**
 * Client-side avatar preparation.
 *
 * The picture is cropped to a square and re-encoded before it ever leaves the
 * device. That is not a security measure — the server validates everything
 * again — it is a courtesy: a 6 MB phone photo becomes roughly 40 KB, which
 * uploads instantly on mobile data and keeps the stored image small.
 */
export const AVATAR_SIZE = 256;
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

export interface PreparedAvatar {
  dataUrl: string;
  bytes: number;
}

export const describeAvatarError = (file: File): 'type' | 'size' | null => {
  if (!(AVATAR_TYPES as readonly string[]).includes(file.type)) return 'type';
  // Ten megabytes in, two megabytes out: the source may be large because the
  // canvas step shrinks it, but an absurd file should fail before decoding.
  if (file.size > 10 * 1024 * 1024) return 'size';
  return null;
};

/** Centre-crops to a square and scales to AVATAR_SIZE, returning a PNG data URL. */
export const prepareAvatar = (file: File): Promise<PreparedAvatar> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      const side = Math.min(image.width, image.height);
      const canvas = document.createElement('canvas');
      canvas.width = AVATAR_SIZE;
      canvas.height = AVATAR_SIZE;
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Canvas is unavailable'));
        return;
      }
      context.drawImage(
        image,
        (image.width - side) / 2,
        (image.height - side) / 2,
        side,
        side,
        0,
        0,
        AVATAR_SIZE,
        AVATAR_SIZE,
      );
      const dataUrl = canvas.toDataURL('image/png');
      resolve({ dataUrl, bytes: Math.ceil(((dataUrl.length - 22) * 3) / 4) });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('The image could not be read'));
    };
    image.src = url;
  });
