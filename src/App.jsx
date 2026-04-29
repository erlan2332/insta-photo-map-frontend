import { lazy, startTransition, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import 'mapbox-gl/dist/mapbox-gl.css'
import './App.css'
import MapTopBar from './components/MapTopBar'
import MobileSearchPocket from './components/MobileSearchPocket'
import { fetchMapPlacesPage, fetchPlaceById } from './api'
import { MAPBOX_TOKEN } from './constants/map'
import { usePlaceMap } from './hooks/usePlaceMap'
import { normalizeCodeQuery } from './utils/search'

const PlaceDesktopPanel = lazy(() => import('./components/PlaceDesktopPanel'))
const ImageViewer = lazy(() => import('./components/ImageViewer'))
const PlaceMobileSheet = lazy(() => import('./components/PlaceMobileSheet'))
const PlaceResultsBar = lazy(() => import('./components/PlaceResultsBar'))
const MAP_VIEW_PAGE_SIZE = 60
const MAX_VIEWPORT_PAGE_REQUESTS = 60
const MAX_VIEWPORT_CACHE_ENTRIES = 6

function toLongitudeRanges(west, east) {
  if (east >= west) {
    return [{ start: west, end: east }]
  }

  return [
    { start: west, end: 180 },
    { start: -180, end: east },
  ]
}

function viewportContains(outerViewport, innerViewport) {
  if (!outerViewport || !innerViewport) {
    return false
  }

  if (innerViewport.north > outerViewport.north || innerViewport.south < outerViewport.south) {
    return false
  }

  const outerRanges = toLongitudeRanges(outerViewport.west, outerViewport.east)
  const innerRanges = toLongitudeRanges(innerViewport.west, innerViewport.east)

  return innerRanges.every((innerRange) => (
    outerRanges.some((outerRange) => (
      innerRange.start >= outerRange.start && innerRange.end <= outerRange.end
    ))
  ))
}

async function fetchViewportPlaces(viewport, signal) {
  const items = []
  let nextPage = 0
  let hasNext = true

  while (hasNext) {
    if (nextPage >= MAX_VIEWPORT_PAGE_REQUESTS) {
      throw new Error('Слишком много точек в этом масштабе. Приблизь карту.')
    }

    const response = await fetchMapPlacesPage({
      ...viewport,
      page: nextPage,
      size: MAP_VIEW_PAGE_SIZE,
      signal,
    })

    items.push(...response.items)
    hasNext = response.hasNext
    nextPage += 1
  }

  return items
}

function App() {
  const mapContainerRef = useRef(null)
  const selectedPlaceIdRef = useRef(null)
  const viewportCacheRef = useRef([])

  const [mapPlaces, setMapPlaces] = useState([])
  const [mapViewport, setMapViewport] = useState(null)
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
    : null
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

  function commitMapPlaces(data, isSearch) {
    startTransition(() => {
      const currentSelectedPlaceId = selectedPlaceIdRef.current
      const nextSelectedPlaceId = data.some((place) => place.id === currentSelectedPlaceId)
        ? currentSelectedPlaceId
        : isSearch && data[0]
          ? data[0].id
          : null

      setMapPlaces(data)
      setSelectedPlaceId(nextSelectedPlaceId)
      setSelectedPlace((current) => (
        data.some((place) => place.id === current?.id) ? current : null
      ))
      setMapLoadingState('ready')

      if (isSearch) {
        setMobileDetailVisible(Boolean(data[0]))
      } else if (!nextSelectedPlaceId) {
        setMobileDetailVisible(false)
      }

      if (nextSelectedPlaceId !== currentSelectedPlaceId) {
        setActivePhotoIndex(0)
        setImageViewerOpen(false)
      }

      if (!data.length) {
        setImageViewerOpen(false)
      }
    })
  }

  function rememberViewportItems(viewport, items) {
    viewportCacheRef.current = [
      { viewport, items },
      ...viewportCacheRef.current.filter((entry) => entry.viewport !== viewport),
    ].slice(0, MAX_VIEWPORT_CACHE_ENTRIES)
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
    onViewportChange: setMapViewport,
  })

  useEffect(() => {
    if (!activeSearchCode && !mapViewport) {
      return undefined
    }

    if (!activeSearchCode && mapViewport) {
      const cachedEntry = viewportCacheRef.current.find((entry) => viewportContains(entry.viewport, mapViewport))

      if (cachedEntry) {
        setMapFeedbackMessage('')
        commitMapPlaces(cachedEntry.items, false)
        return undefined
      }
    }

    const abortController = new AbortController()
    let cancelled = false

    async function loadMapPlaces() {
      try {
        setMapLoadingState('loading')
        setMapFeedbackMessage('')
        const data = activeSearchCode
          ? (await fetchMapPlacesPage({
              code: activeSearchCode,
              page: 0,
              size: 8,
              signal: abortController.signal,
            })).items
          : await fetchViewportPlaces(mapViewport, abortController.signal)

        if (cancelled) {
          return
        }

        if (!activeSearchCode && mapViewport) {
          rememberViewportItems(mapViewport, data)
        }

        commitMapPlaces(data, Boolean(activeSearchCode))
      } catch (error) {
        if (!cancelled && error.name !== 'AbortError') {
          setMapLoadingState('error')
          setMapFeedbackMessage(error.message)
        }
      }
    }

    void loadMapPlaces()

    return () => {
      cancelled = true
      abortController.abort()
    }
  }, [activeSearchCode, mapViewport])

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

      <Suspense fallback={null}>
        <PlaceResultsBar
          activeSearchCode={activeSearchCode}
          places={visiblePlaces}
          selectedPlaceId={stableSelectedPlaceId}
          onSelectPlace={focusPlace}
        />
      </Suspense>

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

      <Suspense fallback={null}>
        <PlaceDesktopPanel
          loadingState={panelLoadingState}
          feedbackMessage={feedbackMessage}
          placeStoryProps={placeStoryProps}
        />
      </Suspense>

      <Suspense fallback={null}>
        <PlaceMobileSheet
          visible={mobileDetailVisible}
          placeTitle={activePlace?.title || selectedPlacePreview?.title}
          loadingState={panelLoadingState}
          feedbackMessage={feedbackMessage}
          onClose={() => setMobileDetailVisible(false)}
          placeStoryProps={placeStoryProps}
        />
      </Suspense>

      <Suspense fallback={null}>
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
      </Suspense>
    </div>
  )
}

export default App
