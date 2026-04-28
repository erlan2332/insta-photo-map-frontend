import { Search, X } from 'lucide-react'

export default function MapTopBar({
  searchInput,
  placesCount,
  onSearchInputChange,
  onSearchSubmit,
  onSearchReset,
}) {
  return (
    <div className="hud hud-top">
      <form
        className="search-bar desktop-only"
        onSubmit={(event) => {
          event.preventDefault()
          onSearchSubmit()
        }}
      >
        <Search size={18} />
        <input
          type="text"
          value={searchInput}
          inputMode="numeric"
          maxLength="6"
          autoComplete="off"
          onChange={(event) => onSearchInputChange(event.target.value)}
          placeholder="Код места"
        />
        {searchInput ? (
          <button
            type="button"
            className="search-clear"
            onClick={onSearchReset}
            aria-label="Очистить поиск"
          >
            <X size={16} />
          </button>
        ) : null}
      </form>

      <div className="hud-actions">
        <div className="count-pill">{placesCount}</div>
      </div>
    </div>
  )
}
