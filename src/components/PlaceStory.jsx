import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Camera, ExternalLink, ZoomIn } from 'lucide-react'
import { resolveMediaUrl } from '../api'
import { getPreloadedImageMetadata, hasPreloadedImage, preloadImage, preloadImageMetadata } from '../utils/media'
import { formatDate, formatYear } from '../utils/formatters'

function StoryCoverImage({ currentPhoto, place }) {
  const previewSrc = resolveMediaUrl(currentPhoto?.previewUrl || currentPhoto?.url || place.coverPhotoUrl)
  const placeholderSrc = resolveMediaUrl(
    currentPhoto?.thumbnailUrl || currentPhoto?.previewUrl || currentPhoto?.url || place.coverPhotoUrl,
  )
  const initialDisplaySrc = hasPreloadedImage(previewSrc) ? previewSrc : (placeholderSrc || previewSrc)
  const [aspectRatio, setAspectRatio] = useState(() => {
    const previewMetadata = getPreloadedImageMetadata(previewSrc)
    const placeholderMetadata = getPreloadedImageMetadata(placeholderSrc)

    return previewMetadata?.aspectRatio || placeholderMetadata?.aspectRatio || null
  })
  const [displaySrc, setDisplaySrc] = useState(() => (
    hasPreloadedImage(previewSrc) ? previewSrc : (placeholderSrc || previewSrc)
  ))

  useEffect(() => {
    let cancelled = false

    async function syncAspectRatio() {
      const initialMetadata = getPreloadedImageMetadata(placeholderSrc) || getPreloadedImageMetadata(previewSrc)
      if (initialMetadata?.aspectRatio && !cancelled) {
        setAspectRatio(initialMetadata.aspectRatio)
      }

      const metadata = await preloadImageMetadata(placeholderSrc || previewSrc)

      if (!cancelled && metadata?.aspectRatio) {
        setAspectRatio(metadata.aspectRatio)
      }
    }

    void syncAspectRatio()

    return () => {
      cancelled = true
    }
  }, [placeholderSrc, previewSrc])

  useEffect(() => {
    let cancelled = false

    if (previewSrc && previewSrc !== initialDisplaySrc) {
      void preloadImage(previewSrc).then((loaded) => {
        if (!cancelled && loaded) {
          setDisplaySrc(previewSrc)
        }
      })
    }

    return () => {
      cancelled = true
    }
  }, [initialDisplaySrc, previewSrc])

  return (
    <div
      className="story-cover__image-shell"
      style={aspectRatio ? { '--story-media-ratio': aspectRatio } : undefined}
    >
      <img
        key={previewSrc}
        src={displaySrc || previewSrc}
        alt={currentPhoto?.altText || place.title}
        fetchPriority="high"
        decoding="async"
      />
    </div>
  )
}

export default function PlaceStory({
  place,
  currentPhoto,
  activePhotoIndex,
  emptyMessage = 'Нажми на точку на карте',
  onPhotoSelect,
  onPrevPhoto,
  onNextPhoto,
  onOpenImage,
}) {
  if (!place) {
    return (
      <div className="panel-empty">
        <Camera size={18} />
        <p>{emptyMessage}</p>
      </div>
    )
  }

  function handleCoverKeyDown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onOpenImage()
    }
  }

  return (
    <div className="story-card">
      <div className="story-cover">
        <div className="story-cover__frame">
          <div
            className="story-cover__media"
          >
            <button
              type="button"
              className="story-cover__tap-target"
              aria-label="Открыть фото крупно"
              onClick={onOpenImage}
              onKeyDown={handleCoverKeyDown}
            />
            <StoryCoverImage
              key={resolveMediaUrl(currentPhoto?.previewUrl || currentPhoto?.url || place.coverPhotoUrl)}
              currentPhoto={currentPhoto}
              place={place}
            />
            <button
              type="button"
              className="story-cover__zoom"
              onClick={(event) => {
                event.stopPropagation()
                onOpenImage()
              }}
              aria-label="Открыть фото крупно"
            >
              <ZoomIn size={16} />
            </button>
            <div className="story-cover__meta">
              <strong className="story-cover__city">{place.city}</strong>
              {place.createdAt ? (
                <p className="story-cover__date">Добавлено {formatDate(place.createdAt)}</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="story-toolbar">
        <button
          type="button"
          className="story-toolbar__button"
          onClick={onPrevPhoto}
          aria-label="Назад"
        >
          <ArrowLeft size={16} />
        </button>

        <div className="story-toolbar__stats">
          <strong>Код {place.placeCode}</strong>
          {place.createdAt ? <span>{formatYear(place.createdAt)}</span> : null}
        </div>

        <button
          type="button"
          className="story-toolbar__button"
          onClick={onNextPhoto}
          aria-label="Вперед"
        >
          <ArrowRight size={16} />
        </button>
      </div>

      <div className="story-thumbs">
        {place.photos.map((photo, index) => (
          <button
            key={photo.id ?? `${place.id}-${index}`}
            type="button"
            className={`story-thumb${index === activePhotoIndex ? ' is-active' : ''}`}
            onClick={() => onPhotoSelect(index)}
          >
            <img
              src={resolveMediaUrl(photo.thumbnailUrl || photo.previewUrl || photo.url)}
              alt={photo.altText}
              loading="eager"
              decoding="async"
              fetchPriority={index < 4 ? 'high' : 'auto'}
            />
          </button>
        ))}
      </div>

      <p className="story-description">{place.description}</p>

      <div className="story-tags">
        {place.tags.map((tag) => (
          <span key={tag}>#{tag}</span>
        ))}
      </div>

      <a
        className="story-link"
        href={`https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`}
        target="_blank"
        rel="noreferrer"
      >
        Маршрут
        <ExternalLink size={16} />
      </a>
    </div>
  )
}
