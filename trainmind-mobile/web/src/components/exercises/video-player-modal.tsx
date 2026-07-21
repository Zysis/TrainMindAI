'use client';

import { Video, X } from 'lucide-react';

interface VideoPlayerModalProps {
  video: { name: string; url: string } | null;
  onClose: () => void;
}

export function VideoPlayerModal({ video, onClose }: VideoPlayerModalProps) {
  if (!video) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative w-full max-w-3xl rounded-xl bg-white dark:bg-slate-800 shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-5 py-3">
            <div className="flex items-center gap-2">
              <Video className="h-5 w-5 text-teal-600" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{video.name}</h3>
            </div>
            <button
              onClick={onClose}
              className="rounded p-1 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="aspect-video bg-black">
            {video.url.includes('youtube.com') || video.url.includes('youtu.be') ? (
              <iframe
                src={video.url
                  .replace('watch?v=', 'embed/')
                  .replace('youtu.be/', 'youtube.com/embed/')
                  .replace(/[&?].*$/, '')}
                className="h-full w-full"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            ) : video.url.includes('vimeo.com') ? (
              <iframe
                src={video.url.replace('vimeo.com/', 'player.vimeo.com/video/')}
                className="h-full w-full"
                allowFullScreen
              />
            ) : (
              <video
                src={video.url}
                controls
                autoPlay
                className="h-full w-full"
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
