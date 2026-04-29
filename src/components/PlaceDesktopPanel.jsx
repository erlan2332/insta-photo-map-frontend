import { LoaderCircle } from 'lucide-react'
import PlaceStory from './PlaceStory'

export default function PlaceDesktopPanel({ loadingState, feedbackMessage, placeStoryProps }) {
  return (
    <div className="hud hud-desktop-panel">
      {loadingState === 'loading' ? (
        <div className="floating-panel floating-panel--state">
          <LoaderCircle size={18} className="spin" />
          <p>Загрузка...</p>
        </div>
      ) : loadingState === 'error' ? (
        <div className="floating-panel floating-panel--state is-error">
          <p>{feedbackMessage || 'Ошибка загрузки'}</p>
        </div>
      ) : (
        <div className="floating-panel">
          <PlaceStory {...placeStoryProps} />
        </div>
      )}
    </div>
  )
}
