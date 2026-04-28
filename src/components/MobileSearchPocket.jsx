import { Search, X } from 'lucide-react'

export default function MobileSearchPocket({
  hidden,
  searchInput,
  activeSearchCode,
  searchMessage,
  onSearchInputChange,
  onSearchSubmit,
  onSearchReset,
}) {
  return (
    <div className={`hud hud-search-pocket${hidden ? ' is-hidden-mobile' : ''}`}>
      <form
        className="search-pocket"
        onSubmit={(event) => {
          event.preventDefault()
          onSearchSubmit()
        }}
      >
        <div className="search-pocket__label">
          <span>Поиск</span>
          {activeSearchCode ? <strong>{activeSearchCode}</strong> : null}
        </div>

        <div className="search-pocket__field">
          <Search size={18} />
          <input
            type="text"
            value={searchInput}
            inputMode="numeric"
            maxLength="6"
            autoComplete="off"
            onChange={(event) => onSearchInputChange(event.target.value)}
            placeholder="Введите код"
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
        </div>

        <button type="submit" className="search-pocket__submit">
          Найти
        </button>

        {searchMessage ? <p className="search-pocket__message">{searchMessage}</p> : null}
      </form>
    </div>
  )
}
