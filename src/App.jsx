import { lazy, startTransition, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import MapTopBar from './components/MapTopBar'
import MobileSearchPocket from './components/MobileSearchPocket'
import { fetchMapPlacesPage, fetchPlaceById, resolveMediaUrl } from './api'
import { MAPBOX_TOKEN } from './constants/map'
import { preloadImage } from './utils/media'
import { normalizeCodeQuery } from './utils/search'

const MapViewport = lazy(() => import('./components/MapViewport'))
const PlaceDesktopPanel = lazy(() => import('./components/PlaceDesktopPanel'))
const ImageViewer = lazy(() => import('./components/ImageViewer'))
const PlaceMobileSheet = lazy(() => import('./components/PlaceMobileSheet'))
const PlaceResultsBar = lazy(() => import('./components/PlaceResultsBar'))
const MAP_VIEW_PAGE_SIZE = 60
const MAX_VIEWPORT_PAGE_REQUESTS = 60
const MAX_VIEWPORT_CACHE_ENTRIES = 6
const PLACE_DETAILS_CACHE_LIMIT = 24
const PLACE_CARD_PREVIEW_PRELOAD_LIMIT = 12

function createPreviewPlace(place) {
  if (!place) {
    return null
  }

  return {
    id: place.id,
    placeCode: place.placeCode,
    title: place.title,
    city: place.city,
    description: '',
    latitude: place.latitude,
    longitude: place.longitude,
    tags: [],
    photos: place.coverPhotoUrl
      ? [{
        id: `preview-${place.id}`,
        url: place.coverPhotoUrl,
        previewUrl: place.coverPhotoUrl,
        thumbnailUrl: place.coverPhotoUrl,
        altText: place.title,
        sortOrder: 0,
      }]
      : [],
    coverPhotoUrl: place.coverPhotoUrl,
    createdAt: place.createdAt,
  }
}

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

function createViewportCacheKey(viewport) {
  if (!viewport) {
    return ''
  }

  return [viewport.north, viewport.south, viewport.east, viewport.west].join(':')
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

function warmPlacePhotoVariants(place) {
  if (!place?.photos?.length) {
    return
  }

  place.photos.forEach((photo) => {
    preloadImage(resolveMediaUrl(photo.thumbnailUrl || photo.previewUrl || photo.url))
  })

  place.photos.slice(0, PLACE_CARD_PREVIEW_PRELOAD_LIMIT).forEach((photo) => {
    preloadImage(resolveMediaUrl(photo.previewUrl || photo.url))
  })
}

function App() {
  const mapViewportRef = useRef(null)
  const selectedPlaceIdRef = useRef(null)
  const viewportCacheRef = useRef([])
  const placeDetailsCacheRef = useRef(new Map())

  const [mapPlaces, setMapPlaces] = useState([])
  const [mapViewport, setMapViewport] = useState(null)
  const [selectedPlaceId, setSelectedPlaceId] = useState(null)
  const [selectedPlace, setSelectedPlace] = useState(null)
  const [activePhotoIndex, setActivePhotoIndex] = useState(0)
  const [searchInput, setSearchInput] = useState('')
  const [activeSearchCode, setActiveSearchCode] = useState('')
  const [searchRequestVersion, setSearchRequestVersion] = useState(0)
  const [mobileDetailVisible, setMobileDetailVisible] = useState(false)
  const [imageViewerOpen, setImageViewerOpen] = useState(false)
  const [mapLoadingState, setMapLoadingState] = useState('loading')
  const [detailLoadingState, setDetailLoadingState] = useState('idle')
  const [mapFeedbackMessage, setMapFeedbackMessage] = useState('')
  const [detailFeedbackMessage, setDetailFeedbackMessage] = useState('')
  const [mapActivated, setMapActivated] = useState(false)

  const visiblePlaces = mapPlaces
  const stableSelectedPlaceId = visiblePlaces.some((place) => place.id === selectedPlaceId)
    ? selectedPlaceId
    : null
  const selectedPlacePreview = visiblePlaces.find((place) => place.id === stableSelectedPlaceId) ?? null
  const previewPlace = selectedPlacePreview ? createPreviewPlace(selectedPlacePreview) : null
  const activePlace = selectedPlace?.id === stableSelectedPlaceId ? selectedPlace : previewPlace
  const currentPhoto =
    activePlace && activePlace.photos.length
      ? activePlace.photos[Math.min(activePhotoIndex, activePlace.photos.length - 1)]
      : null
  const searchMiss = Boolean(activeSearchCode) && mapLoadingState === 'ready' && visiblePlaces.length === 0
  const searchMissMessage = searchMiss ? `Места с кодом ${activeSearchCode} нет` : ''

  const activateMap = useCallback(() => {
    if (!MAPBOX_TOKEN) {
      return
    }

    startTransition(() => {
      setMapActivated(true)
    })
  }, [])

  function selectPlace(place) {
    const cachedPlace = placeDetailsCacheRef.current.get(place.id) ?? null
    const nextSelectedPlace = cachedPlace ?? createPreviewPlace(place)

    setSelectedPlaceId(place.id)
    setSelectedPlace((current) => (current?.id === place.id ? current : nextSelectedPlace))
    setActivePhotoIndex(0)
    setMobileDetailVisible(true)
    setImageViewerOpen(false)
    setDetailFeedbackMessage('')

    if (place.coverPhotoUrl) {
      preloadImage(resolveMediaUrl(place.coverPhotoUrl))
    }
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
    const viewportKey = createViewportCacheKey(viewport)

    viewportCacheRef.current = [
      { key: viewportKey, viewport, items },
      ...viewportCacheRef.current.filter((entry) => entry.key !== viewportKey),
    ].slice(0, MAX_VIEWPORT_CACHE_ENTRIES)
  }

  function rememberPlaceDetails(place) {
    if (!place?.id) {
      return
    }

    const nextCache = new Map(placeDetailsCacheRef.current)
    nextCache.delete(place.id)
    nextCache.set(place.id, place)

    while (nextCache.size > PLACE_DETAILS_CACHE_LIMIT) {
      const oldestKey = nextCache.keys().next().value
      nextCache.delete(oldestKey)
    }

    placeDetailsCacheRef.current = nextCache
  }

  useEffect(() => {
    selectedPlaceIdRef.current = selectedPlaceId
  }, [selectedPlaceId])

  useEffect(() => {
    if (!MAPBOX_TOKEN || mapActivated) {
      return undefined
    }

    const activateOnIdle = () => {
      activateMap()
    }

    if ('requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(activateOnIdle, { timeout: 900 })
      return () => window.cancelIdleCallback(idleId)
    }

    const timeoutId = window.setTimeout(activateOnIdle, 280)
    return () => window.clearTimeout(timeoutId)
  }, [activateMap, mapActivated])

  useEffect(() => {
    if (!activeSearchCode) {
      return undefined
    }

    const abortController = new AbortController()
    let cancelled = false

    async function loadSearchResults() {
      try {
        setMapLoadingState('loading')
        setMapFeedbackMessage('')

        const data = (await fetchMapPlacesPage({
          code: activeSearchCode,
          page: 0,
          size: 8,
          signal: abortController.signal,
        })).items

        if (cancelled) {
          return
        }

        commitMapPlaces(data, true)
      } catch (error) {
        if (!cancelled && error.name !== 'AbortError') {
          setMapLoadingState('error')
          setMapFeedbackMessage(error.message)
        }
      }
    }

    void loadSearchResults()

    return () => {
      cancelled = true
      abortController.abort()
    }
  }, [activeSearchCode, searchRequestVersion])

  useEffect(() => {
    if (activeSearchCode || !mapViewport) {
      return undefined
    }

    const cachedEntry = viewportCacheRef.current.find((entry) => viewportContains(entry.viewport, mapViewport))

    if (cachedEntry) {
      setMapFeedbackMessage('')
      commitMapPlaces(cachedEntry.items, false)
      return undefined
    }

    const abortController = new AbortController()
    let cancelled = false

    async function loadViewportPlaces() {
      try {
        setMapLoadingState('loading')
        setMapFeedbackMessage('')

        const data = await fetchViewportPlaces(mapViewport, abortController.signal)

        if (cancelled) {
          return
        }

        rememberViewportItems(mapViewport, data)
        commitMapPlaces(data, false)
      } catch (error) {
        if (!cancelled && error.name !== 'AbortError') {
          setMapLoadingState('error')
          setMapFeedbackMessage(error.message)
        }
      }
    }

    void loadViewportPlaces()

    return () => {
      cancelled = true
      abortController.abort()
    }
  }, [activeSearchCode, mapViewport])

  useEffect(() => {
    if (!stableSelectedPlaceId) {
      return
    }

    const cachedPlace = placeDetailsCacheRef.current.get(stableSelectedPlaceId)
    const abortController = new AbortController()
    let cancelled = false

    if (cachedPlace) {
      warmPlacePhotoVariants(cachedPlace)
      setSelectedPlace(cachedPlace)
      setDetailLoadingState('ready')
      setDetailFeedbackMessage('')
      return () => {
        cancelled = true
        abortController.abort()
      }
    }

    async function loadPlaceDetails(placeId) {
      try {
        setDetailLoadingState('loading')
        setDetailFeedbackMessage('')
        const data = await fetchPlaceById(placeId, { signal: abortController.signal })

        if (cancelled) {
          return
        }

        rememberPlaceDetails(data)
        warmPlacePhotoVariants(data)
        startTransition(() => {
          setSelectedPlace(data)
          setDetailLoadingState('ready')
        })
      } catch (error) {
        if (!cancelled && error.name !== 'AbortError') {
          setSelectedPlace(null)
          setDetailLoadingState('error')
          setDetailFeedbackMessage(error.message)
        }
      }
    }

    void loadPlaceDetails(stableSelectedPlaceId)

    return () => {
      cancelled = true
      abortController.abort()
    }
  }, [stableSelectedPlaceId])

  useEffect(() => {
    if (!activePlace?.photos?.length) {
      return undefined
    }

    const currentIndex = Math.min(activePhotoIndex, activePlace.photos.length - 1)
    const current = activePlace.photos[currentIndex]
    const next = activePlace.photos[(currentIndex + 1) % activePlace.photos.length]
    const previous = activePlace.photos[(currentIndex - 1 + activePlace.photos.length) % activePlace.photos.length]
    const targets = [current?.url, current?.previewUrl, next?.url, previous?.url]

    const preloadTargets = () => {
      targets.forEach((url) => preloadImage(resolveMediaUrl(url)))
    }

    if ('requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(preloadTargets)
      return () => window.cancelIdleCallback(idleId)
    }

    const timeoutId = window.setTimeout(preloadTargets, 120)
    return () => window.clearTimeout(timeoutId)
  }, [activePlace, activePhotoIndex])

  useEffect(() => {
    if (!selectedPlace?.photos?.length || selectedPlace.id !== stableSelectedPlaceId) {
      return undefined
    }

    warmPlacePhotoVariants(selectedPlace)

    const preloadPhotoVariants = () => {
      selectedPlace.photos.forEach((photo, index) => {
        preloadImage(resolveMediaUrl(photo.thumbnailUrl || photo.previewUrl || photo.url))

        if (index < 6) {
          preloadImage(resolveMediaUrl(photo.previewUrl || photo.url))
        }
      })
    }

    if ('requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(preloadPhotoVariants)
      return () => window.cancelIdleCallback(idleId)
    }

    const timeoutId = window.setTimeout(preloadPhotoVariants, 180)
    return () => window.clearTimeout(timeoutId)
  }, [selectedPlace, stableSelectedPlaceId])

  function focusPlace(place) {
    activateMap()
    selectPlace(place)
    mapViewportRef.current?.focusPlaceOnMap(place)
  }

  function handleSearchInputChange(value) {
    setSearchInput(normalizeCodeQuery(value))
  }

  function submitCodeSearch() {
    const normalizedCode = normalizeCodeQuery(searchInput)

    if (!normalizedCode) {
      resetCodeSearch()
      return
    }

    activateMap()
    setSearchInput(normalizedCode)
    setMapFeedbackMessage('')
    setDetailFeedbackMessage('')
    setMapLoadingState('loading')
    setActiveSearchCode(normalizedCode)
    setSearchRequestVersion((current) => current + 1)
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

  function closeMobileDetail() {
    setMobileDetailVisible(false)
    setImageViewerOpen(false)
    setSelectedPlaceId(null)
    setSelectedPlace(null)
    setActivePhotoIndex(0)
    setDetailLoadingState('idle')
    setDetailFeedbackMessage('')
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
        : stableSelectedPlaceId && detailLoadingState === 'loading' && !activePlace
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

  const mapCanvasFallback = (
    <div className="map-canvas map-canvas--placeholder">
      <div className="map-canvas__boot">
        <strong>Открываем карту</strong>
        <span>Подключаем карту и ближайшие места.</span>
      </div>
    </div>
  )

  return (
    <div className={`map-app${mobileDetailVisible ? ' is-detail-open' : ''}`}>
      {mapActivated && MAPBOX_TOKEN ? (
        <Suspense fallback={mapCanvasFallback}>
          <MapViewport
            ref={mapViewportRef}
            visiblePlaces={visiblePlaces}
            selectedPlaceId={stableSelectedPlaceId}
            activeSearchCode={activeSearchCode}
            onPlaceSelect={selectPlace}
            onViewportChange={setMapViewport}
          />
        </Suspense>
      ) : mapCanvasFallback}

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
          onClose={closeMobileDetail}
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
