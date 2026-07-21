'use client';

import { useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';

interface PhotoPickerProps {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  label?: string;
  size?: number; // px, default 80
}

/**
 * Resizes an image file to a square avatar (max 200×200)
 * and returns a base64 data URL (JPEG, quality 0.85).
 */
function resizeImage(file: File, maxSize = 200): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        // Crop to square from center
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        const outSize = Math.min(side, maxSize);
        canvas.width = outSize;
        canvas.height = outSize;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, outSize, outSize);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function PhotoPicker({ value, onChange, label, size = 80 }: PhotoPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    try {
      const dataUrl = await resizeImage(file);
      onChange(dataUrl);
    } catch (err) {
      console.error('Photo resize error:', err);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      {label && (
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      )}
      <div
        className={`relative cursor-pointer rounded-full border-2 border-dashed transition-colors ${
          dragging
            ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20'
            : 'border-slate-300 dark:border-slate-600 hover:border-teal-400'
        }`}
        style={{ width: size, height: size }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        {value ? (
          <>
            <img
              src={value}
              alt="Photo"
              className="h-full w-full rounded-full object-cover"
            />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(null); }}
              className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow-sm hover:bg-red-600"
            >
              <X className="h-3 w-3" />
            </button>
          </>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center text-slate-400 dark:text-slate-500">
            <Camera className="h-5 w-5" />
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        className="hidden"
      />
    </div>
  );
}
