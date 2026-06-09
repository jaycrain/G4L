'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { setAvatarAction } from './actions.ts';
import { initials } from '../../lib/member/avatar.ts';

// Resize + center-crop a chosen image to a small square JPEG (data URL) entirely in the browser,
// so no upload service is needed and the file stays tiny.
function fileToSquareDataUrl(file: File, size = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min) / 2;
      const sy = (img.height - min) / 2;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('no canvas'));
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Couldn’t read that image — try a JPG or PNG.'));
    };
    img.src = url;
  });
}

export default function AvatarUpload({ initialAvatar, name }: { initialAvatar: string | null; name: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatar, setAvatar] = useState<string | null>(initialAvatar);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    setPending(true);
    setError(null);
    try {
      const dataUrl = await fileToSquareDataUrl(file);
      const r = await setAvatarAction(dataUrl);
      if (r.ok) {
        setAvatar(dataUrl);
        router.refresh();
      } else setError(r.error ?? 'Could not save your photo.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    setPending(true);
    setError(null);
    const r = await setAvatarAction(null);
    if (r.ok) {
      setAvatar(null);
      router.refresh();
    } else setError(r.error ?? 'Could not remove your photo.');
    setPending(false);
  }

  return (
    <div className="avatar-edit">
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="avatar avatar-lg" src={avatar} alt={name} />
      ) : (
        <span className="avatar-initials avatar-lg" aria-hidden="true">{initials(name)}</span>
      )}
      <div className="avatar-edit-actions">
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPick} />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={pending}>
          {pending ? 'Saving…' : avatar ? 'Change photo' : 'Add a photo'}
        </button>
        {avatar && (
          <button type="button" className="btn-secondary" onClick={remove} disabled={pending}>
            Remove
          </button>
        )}
        {error && <p className="error" style={{ marginTop: '0.4rem', fontWeight: 400 }}>{error}</p>}
      </div>
    </div>
  );
}
