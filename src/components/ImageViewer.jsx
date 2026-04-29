import { useRef } from 'react'
import { ArrowLeft, ArrowRight, X, ZoomIn } from 'lucide-react'
import { resolveMediaUrl } from '../api'

export default function ImageViewer({
  open,
  placeTitle,
  currentPhoto,
  photosCount,
  activePhotoIndex,
  onClose,
  onPrevPhoto,
  onNextPhoto,
}) {
  const touchStartRef = useRef(null)

  if (!open || !currentPhoto) {
    return null
  }

  const multiplePhotos = photosCount > 1

  function handleTouchStart(event) {
    if (!multiplePhotos) {
      return
    }

    const touch = event.changedTouches[0]
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
    }
  }

  function handleTouchEnd(event) {
    if (!multiplePhotos || !touchStartRef.current) {
      return
    }

    const touch = event.changedTouches[0]
    const deltaX = touch.clientX - touchStartRef.current.x
    const deltaY = touch.clientY - touchStartRef.current.y

    touchStartRef.current = null

    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) {
      return
    }

    if (deltaX < 0) {
      onNextPhoto()
      return
    }

    onPrevPhoto()
  }

  return (
    <div className="image-viewer" role="dialog" aria-modal="true" aria-label="Просмотр фотографии">
      <button
        type="button"
        className="image-viewer__backdrop"
        onClick={onClose}
        aria-label="Закрыть просмотр"
      />

      <div className="image-viewer__content">
        <div className="image-viewer__topbar">
          <div className="image-viewer__meta">
            <span>{placeTitle || 'Фотография'}</span>
            <strong>
              Фото {activePhotoIndex + 1}
              {multiplePhotos ? ` из ${photosCount}` : ''}
            </strong>
          </div>

          <button
            type="button"
            className="image-viewer__close"
            onClick={onClose}
            aria-label="Закрыть просмотр"
          >
            <X size={18} />
          </button>
        </div>

        <div className="image-viewer__stage">
          <div
            className={`image-viewer__media${multiplePhotos ? ' is-swipeable' : ''}`}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {multiplePhotos ? (
              <button
                type="button"
                className="image-viewer__nav image-viewer__nav--prev"
                onClick={onPrevPhoto}
                aria-label="Предыдущее фото"
              >
                <ArrowLeft size={18} />
              </button>
            ) : null}

            <figure className="image-viewer__figure">
              <img
                src={resolveMediaUrl(currentPhoto.url)}
                alt={currentPhoto.altText || placeTitle}
                fetchPriority="high"
              />
            </figure>

            {multiplePhotos ? (
              <button
                type="button"
                className="image-viewer__nav image-viewer__nav--next"
                onClick={onNextPhoto}
                aria-label="Следующее фото"
              >
                <ArrowRight size={18} />
              </button>
            ) : null}
          </div>
        </div>

        <div className="image-viewer__hint">
          <ZoomIn size={16} />
          <span>{multiplePhotos ? 'Свайп или кнопки для просмотра' : 'Полный просмотр фотографии'}</span>
        </div>
      </div>
    </div>
  )
}
