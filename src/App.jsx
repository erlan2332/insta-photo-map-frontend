import { startTransition, useCallback, useEffect, useRef, useState } from 'react'
import 'mapbox-gl/dist/mapbox-gl.css'
import './App.css'
import MapTopBar from './components/MapTopBar'
import MobileSearchPocket from './components/MobileSearchPocket'
import PlaceDesktopPanel from './components/PlaceDesktopPanel'
import ImageViewer from './components/ImageViewer'
import PlaceMobileSheet from './components/PlaceMobileSheet'
import PlaceResultsBar from './components/PlaceResultsBar'
import { fetchMapPlaces, fetchPlaceById } from './api'
import { MAPBOX_TOKEN } from './constants/map'
import { usePlaceMap } from './hooks/usePlaceMap'
import { normalizeCodeQuery } from './utils/search'

function App() {
  const mapContainerRef = useRef(null)
  const selectedPlaceIdRef = useRef(null)

  const [mapPlaces, setMapPlaces] = useState([])
  const [selectedPlaceId, setSelectedPlaceId] = useState(null)
  const [selectedPlace, setSelectedPlace] = useState(null)
  const [activePhotoIndex, setActivePhotoIndex] = useState(0)
  const [searchInput, setSearchInput] = useState('')
  const [activeSearchCode, setActiveSearchCode] = useState('')
  const [mobileDetailVisible, setMobileDetailVisible] = useState(false)
  const [imageViewerOpen, setImageViewerOpen] = useState(false)
  const [mapLoadingState, setMapLoadingState] = useState('loading')
  const [detailLoadingState, setDetailLoadingState] = useState('idle')
  const [mapFeedbackMessage, setMapFeedbackMessage] = useState('')
  const [detailFeedbackMessage, setDetailFeedbackMessage] = useState('')

  const visiblePlaces = mapPlaces
  const stableSelectedPlaceId = visiblePlaces.some((place) => place.id === selectedPlaceId)
    ? selectedPlaceId
    : visiblePlaces[0]?.id ?? null
  const selectedPlacePreview = visiblePlaces.find((place) => place.id === stableSelectedPlaceId) ?? null
  const activePlace = selectedPlace?.id === stableSelectedPlaceId ? selectedPlace : null
  const currentPhoto =
    activePlace && activePlace.photos.length
      ? activePlace.photos[Math.min(activePhotoIndex, activePlace.photos.length - 1)]
      : null
  const searchMiss = Boolean(activeSearchCode) && mapLoadingState === 'ready' && visiblePlaces.length === 0
  const searchMissMessage = searchMiss ? `Места с кодом ${activeSearchCode} нет` : ''

  function selectPlace(place) {
    setSelectedPlaceId(place.id)
    setSelectedPlace((current) => (current?.id === place.id ? current : null))
    setActivePhotoIndex(0)
    setMobileDetailVisible(true)
    setImageViewerOpen(false)
    setDetailFeedbackMessage('')
  }

  useEffect(() => {
    selectedPlaceIdRef.current = selectedPlaceId
  }, [selectedPlaceId])

  const { focusPlaceOnMap } = usePlaceMap({
    mapContainerRef,
    visiblePlaces,
    selectedPlaceId: stableSelectedPlaceId,
    activeSearchCode,
    onPlaceSelect: selectPlace,
  })

  useEffect(() => {
    let cancelled = false

    async function loadMapPlaces(placeCode = '') {
      try {
        setMapLoadingState('loading')
        setMapFeedbackMessage('')
        const data = await fetchMapPlaces(placeCode)

        if (cancelled) {
          return
        }

        startTransition(() => {
          const currentSelectedPlaceId = selectedPlaceIdRef.current
          const nextSelectedPlaceId = data.some((place) => place.id === currentSelectedPlaceId)
            ? currentSelectedPlaceId
            : data[0]?.id ?? null

          setMapPlaces(data)
          setSelectedPlaceId(nextSelectedPlaceId)
          setSelectedPlace((current) => (
            data.some((place) => place.id === current?.id) ? current : null
          ))
          setMapLoadingState('ready')
          setMobileDetailVisible(Boolean(placeCode && data[0]))

          if (nextSelectedPlaceId !== currentSelectedPlaceId) {
            setActivePhotoIndex(0)
            setImageViewerOpen(false)
          }

          if (!data.length) {
            setImageViewerOpen(false)
          }
        })
      } catch (error) {
        if (!cancelled) {
          setMapLoadingState('error')
          setMapFeedbackMessage(error.message)
        }
      }
    }

    void loadMapPlaces(activeSearchCode)

    return () => {
      cancelled = true
    }
  }, [activeSearchCode])

  useEffect(() => {
    if (!stableSelectedPlaceId) {
      return
    }

    let cancelled = false

    async function loadPlaceDetails(placeId) {
      try {
        setDetailLoadingState('loading')
        setDetailFeedbackMessage('')
        const data = await fetchPlaceById(placeId)

        if (cancelled) {
          return
        }

        startTransition(() => {
          setSelectedPlace(data)
          setDetailLoadingState('ready')
        })
      } catch (error) {
        if (!cancelled) {
          setSelectedPlace(null)
          setDetailLoadingState('error')
          setDetailFeedbackMessage(error.message)
        }
      }
    }

    void loadPlaceDetails(stableSelectedPlaceId)

    return () => {
      cancelled = true
    }
  }, [stableSelectedPlaceId])

  function focusPlace(place) {
    selectPlace(place)
    focusPlaceOnMap(place)
  }

  function handleSearchInputChange(value) {
    setSearchInput(normalizeCodeQuery(value))
  }

  function submitCodeSearch() {
    const normalizedCode = normalizeCodeQuery(searchInput)
    setSearchInput(normalizedCode)
    setActiveSearchCode(normalizedCode)
    setMapFeedbackMessage('')
    setDetailFeedbackMessage('')
    setMapLoadingState('loading')
  }

  function resetCodeSearch() {
    setSearchInput('')
    setActiveSearchCode('')
    setMapFeedbackMessage('')
    setDetailFeedbackMessage('')
    setMapLoadingState('loading')
    setMobileDetailVisible(false)
    setImageViewerOpen(false)
  }

  const showPreviousPhoto = useCallback(() => {
    if (!activePlace || activePlace.photos.length < 2) {
      return
    }

    setActivePhotoIndex((current) =>
      current === 0 ? activePlace.photos.length - 1 : current - 1,
    )
  }, [activePlace])

  const showNextPhoto = useCallback(() => {
    if (!activePlace || activePlace.photos.length < 2) {
      return
    }

    setActivePhotoIndex((current) =>
      current === activePlace.photos.length - 1 ? 0 : current + 1,
    )
  }, [activePlace])

  useEffect(() => {
    if (!imageViewerOpen) {
      return undefined
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setImageViewerOpen(false)
        return
      }

      if (event.key === 'ArrowLeft') {
        showPreviousPhoto()
      }

      if (event.key === 'ArrowRight') {
        showNextPhoto()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [imageViewerOpen, showNextPhoto, showPreviousPhoto])

  const panelLoadingState = mapLoadingState === 'error'
    ? 'error'
    : mapLoadingState === 'loading' && !visiblePlaces.length
      ? 'loading'
      : stableSelectedPlaceId && detailLoadingState === 'error'
        ? 'error'
        : stableSelectedPlaceId && detailLoadingState === 'loading'
          ? 'loading'
          : 'ready'

  const feedbackMessage = mapLoadingState === 'error'
    ? mapFeedbackMessage
    : stableSelectedPlaceId
      ? detailFeedbackMessage
      : ''

  const placeStoryProps = {
    place: activePlace,
    currentPhoto,
    activePhotoIndex,
    emptyMessage: searchMissMessage || 'Нажми на точку на карте',
    onPhotoSelect: setActivePhotoIndex,
    onPrevPhoto: showPreviousPhoto,
    onNextPhoto: showNextPhoto,
    onOpenImage: () => setImageViewerOpen(true),
  }

  return (
    <div className={`map-app${mobileDetailVisible ? ' is-detail-open' : ''}`}>
      <div ref={mapContainerRef} className="map-canvas" />

      <div className="map-gradient" />

      <MapTopBar
        searchInput={searchInput}
        placesCount={visiblePlaces.length}
        onSearchInputChange={handleSearchInputChange}
        onSearchSubmit={submitCodeSearch}
        onSearchReset={resetCodeSearch}
      />

      <PlaceResultsBar
        activeSearchCode={activeSearchCode}
        places={visiblePlaces}
        selectedPlaceId={stableSelectedPlaceId}
        onSelectPlace={focusPlace}
      />

      <MobileSearchPocket
        hidden={mobileDetailVisible}
        searchInput={searchInput}
        activeSearchCode={activeSearchCode}
        searchMessage={searchMissMessage}
        onSearchInputChange={handleSearchInputChange}
        onSearchSubmit={submitCodeSearch}
        onSearchReset={resetCodeSearch}
      />

      {!MAPBOX_TOKEN ? (
        <div className="token-warning">
          <strong>Нужен Mapbox token</strong>
          <span>Добавь `VITE_MAPBOX_TOKEN=pk...` в `.env` внутри `frontend`.</span>
        </div>
      ) : null}

      <PlaceDesktopPanel
        loadingState={panelLoadingState}
        feedbackMessage={feedbackMessage}
        placeStoryProps={placeStoryProps}
      />

      <PlaceMobileSheet
        visible={mobileDetailVisible}
        placeTitle={activePlace?.title || selectedPlacePreview?.title}
        loadingState={panelLoadingState}
        feedbackMessage={feedbackMessage}
        onClose={() => setMobileDetailVisible(false)}
        placeStoryProps={placeStoryProps}
      />

      <ImageViewer
        open={imageViewerOpen}
        placeTitle={activePlace?.title || selectedPlacePreview?.title}
        currentPhoto={currentPhoto}
        photosCount={activePlace?.photos.length ?? 0}
        activePhotoIndex={activePhotoIndex}
        onClose={() => setImageViewerOpen(false)}
        onPrevPhoto={showPreviousPhoto}
        onNextPhoto={showNextPhoto}
      />
    </div>
  )
}

export default App
