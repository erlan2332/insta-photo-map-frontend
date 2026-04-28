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
  if (!open || !currentPhoto) {
    return null
  }

  const multiplePhotos = photosCount > 1

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
            <img src={resolveMediaUrl(currentPhoto.url)} alt={currentPhoto.altText || placeTitle} />
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

        <div className="image-viewer__hint">
          <ZoomIn size={16} />
          <span>Полный просмотр фотографии</span>
        </div>
      </div>
    </div>
  )
}
