import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { resolveMediaUrl } from '../api'
import {
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  MAPBOX_TOKEN,
  PLACE_CLUSTER_LAYER_ID,
  PLACE_CLUSTER_MAX_ZOOM,
  PLACE_HIT_LAYER_ID,
  PLACE_LAYER_ID,
  PLACE_SOURCE_ID,
} from '../constants/map'
import {
  createClusterMarkerImage,
  createGenericMapMarkerImages,
  createMapMarkerImages,
} from '../utils/mapMarkers'

const VIEWPORT_PAD_FACTOR = 0.4
const VIEWPORT_PRECISION = 1000
const PLACE_CLUSTER_ICON_ID = 'place-cluster-icon'
const PLACE_GENERIC_ICON_ID = 'place-generic-icon'
const PLACE_GENERIC_ACTIVE_ICON_ID = 'place-generic-active-icon'
const MARKER_SYNC_BATCH_SIZE = 6

function clampLatitude(value) {
  return Math.max(-90, Math.min(90, value))
}

function wrapLongitude(value) {
  let wrappedValue = value

  while (wrappedValue > 180) {
    wrappedValue -= 360
  }

  while (wrappedValue < -180) {
    wrappedValue += 360
  }

  return wrappedValue
}

function roundCoordinate(value) {
  return Math.round(value * VIEWPORT_PRECISION) / VIEWPORT_PRECISION
}

function createViewportSnapshot(map) {
  const bounds = map.getBounds()
  const north = bounds.getNorth()
  const south = bounds.getSouth()
  const east = bounds.getEast()
  const west = bounds.getWest()
  const latitudePadding = (north - south) * VIEWPORT_PAD_FACTOR
  const longitudePadding = (east - west) * VIEWPORT_PAD_FACTOR

  return {
    north: roundCoordinate(clampLatitude(north + latitudePadding)),
    south: roundCoordinate(clampLatitude(south - latitudePadding)),
    east: roundCoordinate(wrapLongitude(east + longitudePadding)),
    west: roundCoordinate(wrapLongitude(west - longitudePadding)),
  }
}

function findInteractiveMapFeature(map, point) {
  if (!map) {
    return null
  }

  const features = map.queryRenderedFeatures([
    [point.x - 26, point.y - 32],
    [point.x + 26, point.y + 12],
  ], {
    layers: [PLACE_HIT_LAYER_ID, PLACE_LAYER_ID, PLACE_CLUSTER_LAYER_ID],
  })

  return features[0] ?? null
}

export function usePlaceMap({
  mapContainerRef,
  visiblePlaces,
  selectedPlaceId,
  activeSearchCode,
  onPlaceSelect,
  onViewportChange,
}) {
  const mapRef = useRef(null)
  const layerHandlersBoundRef = useRef(false)
  const lastViewportKeyRef = useRef('')
  const renderedPlaceIdsRef = useRef(new Set())
  const shouldAutoFitDefaultViewRef = useRef(true)
  const previousSearchCodeRef = useRef('')
  const photoMarkersReadyTimeoutRef = useRef(null)
  const [mapReady, setMapReady] = useState(false)
  const [photoMarkersReady, setPhotoMarkersReady] = useState(false)

  const handlePlaceSelect = useEffectEvent((placeId) => {
    const place = visiblePlaces.find((item) => item.id === placeId)

    if (place) {
      onPlaceSelect(place)
    }
  })

  const reportViewportChange = useEffectEvent(() => {
    if (!mapRef.current || !onViewportChange) {
      return
    }

    const nextViewport = createViewportSnapshot(mapRef.current)
    const nextViewportKey = [
      nextViewport.north,
      nextViewport.south,
      nextViewport.east,
      nextViewport.west,
    ].join(':')

    if (lastViewportKeyRef.current === nextViewportKey) {
      return
    }

    lastViewportKeyRef.current = nextViewportKey
    onViewportChange(nextViewport)
  })

  function schedulePhotoMarkersReady(nextValue) {
    if (photoMarkersReadyTimeoutRef.current !== null) {
      window.clearTimeout(photoMarkersReadyTimeoutRef.current)
    }

    photoMarkersReadyTimeoutRef.current = window.setTimeout(() => {
      setPhotoMarkersReady(nextValue)
      photoMarkersReadyTimeoutRef.current = null
    }, 0)
  }

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current || !MAPBOX_TOKEN) {
      return
    }

    let cancelled = false

    async function initMap() {
      const mapboxModule = await import('mapbox-gl')
      const mapboxgl = mapboxModule.default

      if (cancelled || !mapContainerRef.current || mapRef.current) {
        return
      }

      mapboxgl.accessToken = MAPBOX_TOKEN

      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/standard',
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        pitch: 14,
        bearing: -10,
        antialias: true,
        attributionControl: false,
      })

      map.addControl(
        new mapboxgl.NavigationControl({ visualizePitch: false, showCompass: false }),
        'top-right',
      )
      map.addControl(new mapboxgl.AttributionControl({ compact: false }), 'top-left')
      map.on('load', () => {
        map.setFog({
          range: [-0.35, 1.6],
          color: '#f2ede3',
          'high-color': '#23485f',
          'space-color': '#071018',
          'horizon-blend': 0.08,
          'star-intensity': 0,
        })
        setMapReady(true)
        reportViewportChange()
      })
      map.on('moveend', reportViewportChange)

      mapRef.current = map
    }

    void initMap()

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [mapContainerRef])

  useEffect(() => {
    if (!mapReady || !mapRef.current) {
      return
    }

    const map = mapRef.current

    if (!map.getSource(PLACE_SOURCE_ID)) {
      map.addSource(PLACE_SOURCE_ID, {
        type: 'geojson',
        cluster: true,
        clusterMaxZoom: PLACE_CLUSTER_MAX_ZOOM,
        clusterRadius: 60,
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      })
    }

    if (!map.hasImage(PLACE_CLUSTER_ICON_ID)) {
      const clusterMarkerImage = createClusterMarkerImage()

      if (clusterMarkerImage) {
        map.addImage(PLACE_CLUSTER_ICON_ID, clusterMarkerImage.image, {
          pixelRatio: clusterMarkerImage.pixelRatio,
        })
      }
    }

    if (!map.hasImage(PLACE_GENERIC_ICON_ID) || !map.hasImage(PLACE_GENERIC_ACTIVE_ICON_ID)) {
      const genericMarkerImages = createGenericMapMarkerImages()

      if (genericMarkerImages.normal && !map.hasImage(PLACE_GENERIC_ICON_ID)) {
        map.addImage(PLACE_GENERIC_ICON_ID, genericMarkerImages.normal.image, {
          pixelRatio: genericMarkerImages.normal.pixelRatio,
        })
      }

      if (genericMarkerImages.active && !map.hasImage(PLACE_GENERIC_ACTIVE_ICON_ID)) {
        map.addImage(PLACE_GENERIC_ACTIVE_ICON_ID, genericMarkerImages.active.image, {
          pixelRatio: genericMarkerImages.active.pixelRatio,
        })
      }
    }

    if (!map.getLayer(PLACE_CLUSTER_LAYER_ID)) {
      map.addLayer({
        id: PLACE_CLUSTER_LAYER_ID,
        type: 'symbol',
        source: PLACE_SOURCE_ID,
        filter: ['has', 'point_count'],
        layout: {
          'icon-image': PLACE_CLUSTER_ICON_ID,
          'icon-anchor': 'bottom',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['DIN Offc Pro Bold', 'Arial Unicode MS Bold'],
          'text-size': [
            'step',
            ['get', 'point_count'],
            15,
            10,
            17,
            20,
            18,
            100,
            16,
          ],
          'text-anchor': 'center',
          'text-justify': 'center',
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': 'rgba(8, 13, 18, 0.22)',
          'text-halo-width': 1,
          'text-translate': [0, -42],
          'text-translate-anchor': 'viewport',
        },
      })
    }

    if (!map.getLayer(PLACE_LAYER_ID)) {
      map.addLayer({
        id: PLACE_LAYER_ID,
        type: 'symbol',
        source: PLACE_SOURCE_ID,
        filter: ['!', ['has', 'point_count']],
        layout: {
          'icon-image': ['get', 'iconId'],
          'icon-anchor': 'bottom',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      })
    }

    if (!map.getLayer(PLACE_HIT_LAYER_ID)) {
      map.addLayer({
        id: PLACE_HIT_LAYER_ID,
        type: 'circle',
        source: PLACE_SOURCE_ID,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': 34,
          'circle-color': '#ffffff',
          'circle-opacity': 0.035,
          'circle-stroke-width': 0,
          'circle-stroke-opacity': 0,
          'circle-translate': [0, -34],
          'circle-translate-anchor': 'viewport',
        },
      })
    }

    if (!layerHandlersBoundRef.current) {
      const focusCluster = (feature) => {
        const clusterId = Number(feature?.properties?.cluster_id)
        const source = map.getSource(PLACE_SOURCE_ID)

        if (
          Number.isNaN(clusterId)
          || !source
          || typeof source.getClusterExpansionZoom !== 'function'
        ) {
          return
        }

        source.getClusterExpansionZoom(clusterId, (error, zoom) => {
          if (error || !feature.geometry || feature.geometry.type !== 'Point') {
            return
          }

          map.easeTo({
            center: feature.geometry.coordinates,
            zoom: Math.max(zoom, 8.1),
            duration: 650,
          })
        })
      }

      const focusPlaceFeature = (feature) => {
        const placeId = Number(feature?.properties?.id)

        if (!Number.isNaN(placeId)) {
          handlePlaceSelect(placeId)
        }
      }

      map.on('click', PLACE_CLUSTER_LAYER_ID, (event) => {
        const feature = event.features?.[0]
        if (feature) {
          focusCluster(feature)
        }
      })

      map.on('click', PLACE_LAYER_ID, (event) => {
        const feature = event.features?.[0]
        if (feature) {
          focusPlaceFeature(feature)
        }
      })

      map.on('click', PLACE_HIT_LAYER_ID, (event) => {
        const feature = event.features?.[0]
        if (feature) {
          focusPlaceFeature(feature)
        }
      })

      map.on('click', (event) => {
        const feature = findInteractiveMapFeature(map, event.point)

        if (!feature) {
          return
        }

        if (feature.layer?.id === PLACE_CLUSTER_LAYER_ID) {
          focusCluster(feature)
          return
        }

        if (feature.layer?.id === PLACE_LAYER_ID || feature.layer?.id === PLACE_HIT_LAYER_ID) {
          focusPlaceFeature(feature)
        }
      })

      map.on('mouseenter', PLACE_LAYER_ID, () => {
        map.getCanvas().style.cursor = 'pointer'
      })

      map.on('mouseenter', PLACE_HIT_LAYER_ID, () => {
        map.getCanvas().style.cursor = 'pointer'
      })

      map.on('mouseenter', PLACE_CLUSTER_LAYER_ID, () => {
        map.getCanvas().style.cursor = 'pointer'
      })

      map.on('mouseleave', PLACE_LAYER_ID, () => {
        map.getCanvas().style.cursor = ''
      })

      map.on('mouseleave', PLACE_HIT_LAYER_ID, () => {
        map.getCanvas().style.cursor = ''
      })

      map.on('mouseleave', PLACE_CLUSTER_LAYER_ID, () => {
        map.getCanvas().style.cursor = ''
      })

      layerHandlersBoundRef.current = true
    }
  }, [mapReady])

  useEffect(() => {
    if (!mapReady || !mapRef.current) {
      return
    }

    const map = mapRef.current
    const source = map.getSource(PLACE_SOURCE_ID)

    if (!source) {
      return
    }

    const nextData = {
      type: 'FeatureCollection',
      features: visiblePlaces.map((place) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [place.longitude, place.latitude],
        },
        properties: {
          id: place.id,
          iconId: `place-icon-${place.id}`,
          activeIconId: `place-icon-${place.id}-active`,
          fallbackIconId: PLACE_GENERIC_ICON_ID,
          fallbackActiveIconId: PLACE_GENERIC_ACTIVE_ICON_ID,
        },
      })),
    }

    if (!visiblePlaces.length) {
      renderedPlaceIdsRef.current.forEach((placeId) => {
        const iconId = `place-icon-${placeId}`
        const activeIconId = `place-icon-${placeId}-active`

        if (map.hasImage(iconId)) {
          map.removeImage(iconId)
        }

        if (map.hasImage(activeIconId)) {
          map.removeImage(activeIconId)
        }
      })
      renderedPlaceIdsRef.current = new Set()
      schedulePhotoMarkersReady(false)
      source.setData({
        type: 'FeatureCollection',
        features: [],
      })
      return
    }

    source.setData(nextData)

    let cancelled = false
    let idleCallbackId = null
    let timeoutId = null

    const nextPlaceIds = new Set(visiblePlaces.map((place) => place.id))
    const missingPlaces = visiblePlaces.filter((place) => {
      const iconId = `place-icon-${place.id}`
      const activeIconId = `place-icon-${place.id}-active`
      return !map.hasImage(iconId) || !map.hasImage(activeIconId)
    })

    if (!missingPlaces.length) {
      renderedPlaceIdsRef.current.forEach((placeId) => {
        if (nextPlaceIds.has(placeId)) {
          return
        }

        const iconId = `place-icon-${placeId}`
        const activeIconId = `place-icon-${placeId}-active`

        if (map.hasImage(iconId)) {
          map.removeImage(iconId)
        }

        if (map.hasImage(activeIconId)) {
          map.removeImage(activeIconId)
        }
      })

      renderedPlaceIdsRef.current = nextPlaceIds
      schedulePhotoMarkersReady(true)
      source.setData(nextData)
      return
    }

    schedulePhotoMarkersReady(false)

    async function syncPlaceLayer() {
      for (let index = 0; index < missingPlaces.length; index += MARKER_SYNC_BATCH_SIZE) {
        const batch = missingPlaces.slice(index, index + MARKER_SYNC_BATCH_SIZE)

        await Promise.all(batch.map(async (place) => {
          const iconId = `place-icon-${place.id}`
          const activeIconId = `place-icon-${place.id}-active`
          const coverPhotoUrl = resolveMediaUrl(place.coverPhotoUrl)
          const markerImages = await createMapMarkerImages(coverPhotoUrl)

          if (cancelled || !markerImages) {
            return
          }

          if (markerImages.normal && !map.hasImage(iconId)) {
            map.addImage(iconId, markerImages.normal.image, {
              pixelRatio: markerImages.normal.pixelRatio,
            })
          }

          if (markerImages.active && !map.hasImage(activeIconId)) {
            map.addImage(activeIconId, markerImages.active.image, {
              pixelRatio: markerImages.active.pixelRatio,
            })
          }
        }))

        if (cancelled) {
          return
        }
      }

      if (cancelled) {
        return
      }

      renderedPlaceIdsRef.current.forEach((placeId) => {
        if (nextPlaceIds.has(placeId)) {
          return
        }

        const iconId = `place-icon-${placeId}`
        const activeIconId = `place-icon-${placeId}-active`

        if (map.hasImage(iconId)) {
          map.removeImage(iconId)
        }

        if (map.hasImage(activeIconId)) {
          map.removeImage(activeIconId)
        }
      })

      renderedPlaceIdsRef.current = nextPlaceIds
      source.setData(nextData)
      schedulePhotoMarkersReady(true)
    }

    const startWarmup = () => {
      void syncPlaceLayer()
    }

    if ('requestIdleCallback' in window) {
      idleCallbackId = window.requestIdleCallback(startWarmup, { timeout: 420 })
    } else {
      timeoutId = window.setTimeout(startWarmup, 180)
    }

    return () => {
      cancelled = true
      if (idleCallbackId !== null && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleCallbackId)
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
      if (photoMarkersReadyTimeoutRef.current !== null) {
        window.clearTimeout(photoMarkersReadyTimeoutRef.current)
        photoMarkersReadyTimeoutRef.current = null
      }
    }
  }, [mapReady, visiblePlaces])

  useEffect(() => {
    if (previousSearchCodeRef.current && !activeSearchCode) {
      shouldAutoFitDefaultViewRef.current = true
    }

    previousSearchCodeRef.current = activeSearchCode
  }, [activeSearchCode])

  useEffect(() => {
    if (!mapReady || !mapRef.current || !mapRef.current.getLayer(PLACE_LAYER_ID)) {
      return
    }

    const iconProperty = photoMarkersReady ? 'iconId' : 'fallbackIconId'
    const activeIconProperty = photoMarkersReady ? 'activeIconId' : 'fallbackActiveIconId'

    mapRef.current.setLayoutProperty(PLACE_LAYER_ID, 'icon-image', [
      'case',
      ['==', ['get', 'id'], selectedPlaceId ?? -1],
      ['get', activeIconProperty],
      ['get', iconProperty],
    ])
  }, [mapReady, photoMarkersReady, selectedPlaceId])

  useEffect(() => {
    if (!mapRef.current || !visiblePlaces.length) {
      return
    }

    if (!activeSearchCode && !shouldAutoFitDefaultViewRef.current) {
      return
    }

    const bounds = visiblePlaces.reduce((currentBounds, place) => ({
      minLng: Math.min(currentBounds.minLng, place.longitude),
      minLat: Math.min(currentBounds.minLat, place.latitude),
      maxLng: Math.max(currentBounds.maxLng, place.longitude),
      maxLat: Math.max(currentBounds.maxLat, place.latitude),
    }), {
      minLng: Infinity,
      minLat: Infinity,
      maxLng: -Infinity,
      maxLat: -Infinity,
    })

    mapRef.current.fitBounds([[bounds.minLng, bounds.minLat], [bounds.maxLng, bounds.maxLat]], {
      padding: 120,
      maxZoom: visiblePlaces.length === 1 ? 10.5 : 7.8,
      duration: 900,
    })

    if (!activeSearchCode) {
      shouldAutoFitDefaultViewRef.current = false
    }
  }, [visiblePlaces, activeSearchCode])

  function focusPlaceOnMap(place) {
    if (!mapRef.current) {
      return
    }

    mapRef.current.flyTo({
      center: [place.longitude, place.latitude],
      zoom: Math.max(mapRef.current.getZoom(), 8.1),
      pitch: 16,
      bearing: -8,
      duration: 900,
      essential: true,
    })
  }

  return {
    focusPlaceOnMap,
  }
}
