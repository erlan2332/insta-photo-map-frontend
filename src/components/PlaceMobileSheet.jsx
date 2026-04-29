import { LoaderCircle, X } from 'lucide-react'
import PlaceStory from './PlaceStory'

export default function PlaceMobileSheet({
  visible,
  placeTitle,
  loadingState,
  feedbackMessage,
  onClose,
  placeStoryProps,
}) {
  return (
    <div className={`mobile-sheet${visible ? ' is-visible' : ''}`}>
      <div className="mobile-sheet__body">
        <div className="mobile-sheet__topbar">
          <strong>{placeTitle || 'Место'}</strong>
          <button
            type="button"
            className="circle-button mobile-sheet__close"
            onClick={onClose}
            aria-label="Закрыть карточку"
          >
            <X size={18} />
          </button>
        </div>

        {loadingState === 'loading' ? (
          <div className="panel-empty">
            <LoaderCircle size={18} className="spin" />
            <p>Загрузка...</p>
          </div>
        ) : loadingState === 'error' ? (
          <div className="panel-empty">
            <p>{feedbackMessage || 'Ошибка загрузки'}</p>
          </div>
        ) : (
          <PlaceStory {...placeStoryProps} />
        )}
      </div>
    </div>
  )
}
