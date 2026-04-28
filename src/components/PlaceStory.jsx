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

  return (
    <div className="story-card">
      <div className="story-cover">
        <div className="story-cover__frame">
          <img
            src={resolveMediaUrl(currentPhoto?.url || place.coverPhotoUrl)}
            alt={currentPhoto?.altText || place.title}
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
            <span>{place.city}</span>
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
          <span>Добавлено {formatDate(place.createdAt)}</span>
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
            <img src={resolveMediaUrl(photo.url)} alt={photo.altText} />
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
