import { resolveMediaUrl } from '../api'

export default function PlaceResultsBar({
  activeSearchCode,
  places,
  selectedPlaceId,
  onSelectPlace,
}) {
  if (!activeSearchCode || !places.length) {
    return null
  }

  return (
    <div className="hud hud-results">
      {places.slice(0, 8).map((place) => (
        <button
          key={place.id}
          type="button"
          className={`result-pill${place.id === selectedPlaceId ? ' is-active' : ''}`}
          onClick={() => onSelectPlace(place)}
        >
          <img src={resolveMediaUrl(place.coverPhotoUrl)} alt={place.title} />
          <span>{place.placeCode} · {place.title}</span>
        </button>
      ))}
    </div>
  )
}
