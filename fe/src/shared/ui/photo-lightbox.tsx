import { useEffect } from 'react';

import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface Photo {
  url: string;
}

interface Props {
  photos: Photo[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export function PhotoLightbox(props: Props) {
  const { photos, index, onClose, onNavigate } = props;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') {
        onNavigate((index - 1 + photos.length) % photos.length);
      }
      if (e.key === 'ArrowRight') {
        onNavigate((index + 1) % photos.length);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [index, photos.length, onClose, onNavigate]);

  const photo = photos[index];

  if (!photo) return null;

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/90'
      onClick={onClose}
    >
      <button
        type='button'
        aria-label='Закрыть'
        onClick={onClose}
        className='absolute right-4 top-4 flex size-10 items-center justify-center rounded-full text-white/80 transition-colors hover:text-white'
      >
        <X size={24} />
      </button>

      {photos.length > 1 && (
        <button
          type='button'
          aria-label='Предыдущее фото'
          onClick={e => {
            e.stopPropagation();
            onNavigate((index - 1 + photos.length) % photos.length);
          }}
          className='absolute left-4 flex size-10 items-center justify-center rounded-full text-white/80 transition-colors hover:text-white'
        >
          <ChevronLeft size={28} />
        </button>
      )}

      <img
        src={photo.url}
        alt=''
        className='max-h-[85vh] max-w-[85vw] object-contain'
        onClick={e => e.stopPropagation()}
      />

      {photos.length > 1 && (
        <button
          type='button'
          aria-label='Следующее фото'
          onClick={e => {
            e.stopPropagation();
            onNavigate((index + 1) % photos.length);
          }}
          className='absolute right-4 flex size-10 items-center justify-center rounded-full text-white/80 transition-colors hover:text-white'
        >
          <ChevronRight size={28} />
        </button>
      )}
    </div>
  );
}
