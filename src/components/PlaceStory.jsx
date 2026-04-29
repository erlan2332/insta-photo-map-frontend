import { ArrowLeft, ArrowRight, Camera, ExternalLink, ZoomIn } from 'lucide-react'
import { resolveMediaUrl } from '../api'
import { formatDate } from '../utils/formatters'

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

  const coverSrc = resolveMediaUrl(currentPhoto?.previewUrl || currentPhoto?.url || place.coverPhotoUrl)

  return (
    <div className="story-card">
      <div className="story-cover">
        <div className="story-cover__frame">
          <div className="story-cover__media">
            <img
              key={coverSrc}
              src={coverSrc}
              alt={currentPhoto?.altText || place.title}
              fetchPriority="high"
            />
            <button
              type="button"
              className="story-cover__zoom"
              onClick={onOpenImage}
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
