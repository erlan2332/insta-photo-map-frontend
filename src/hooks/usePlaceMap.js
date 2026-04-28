import { useEffect, useEffectEvent, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import { resolveMediaUrl } from '../api'
import {
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  MAPBOX_TOKEN,
  PLACE_LAYER_ID,
  PLACE_SOURCE_ID,
} from '../constants/map'
import { createMapMarkerImage } from '../utils/mapMarkers'

export function usePlaceMap({
  mapContainerRef,
  visiblePlaces,
  selectedPlaceId,
  activeSearchCode,
  onPlaceSelect,
}) {
  const mapRef = useRef(null)
  const initialViewportAppliedRef = useRef(false)
  const layerHandlersBoundRef = useRef(false)
  const [mapReady, setMapReady] = useState(false)

  const handlePlaceSelect = useEffectEvent((placeId) => {
    const place = visiblePlaces.find((item) => item.id === placeId)

    if (place) {
      onPlaceSelect(place)
    }
  })

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current || !MAPBOX_TOKEN) {
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
    })

    mapRef.current = map

    return () => {
      map.remove()
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
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      })
    }

    if (!map.getLayer(PLACE_LAYER_ID)) {
      map.addLayer({
        id: PLACE_LAYER_ID,
        type: 'symbol',
        source: PLACE_SOURCE_ID,
        layout: {
          'icon-image': ['get', 'iconId'],
          'icon-anchor': 'bottom',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      })
    }

    if (!layerHandlersBoundRef.current) {
      map.on('click', PLACE_LAYER_ID, (event) => {
        const feature = event.features?.[0]
        const placeId = Number(feature?.properties?.id)

        if (!Number.isNaN(placeId)) {
          handlePlaceSelect(placeId)
        }
      })

      map.on('mouseenter', PLACE_LAYER_ID, () => {
        map.getCanvas().style.cursor = 'pointer'
      })

      map.on('mouseleave', PLACE_LAYER_ID, () => {
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

    if (!visiblePlaces.length) {
      source.setData({
        type: 'FeatureCollection',
        features: [],
      })
      return
    }

    let cancelled = false

    async function syncPlaceLayer() {
      for (const place of visiblePlaces) {
        const iconId = `place-icon-${place.id}`
        const activeIconId = `place-icon-${place.id}-active`
        const coverPhotoUrl = resolveMediaUrl(place.coverPhotoUrl)

        if (!map.hasImage(iconId)) {
          const normalMarkerImage = await createMapMarkerImage(coverPhotoUrl, false)

          if (cancelled) {
            return
          }

          if (normalMarkerImage && !map.hasImage(iconId)) {
            map.addImage(iconId, normalMarkerImage.image, {
              pixelRatio: normalMarkerImage.pixelRatio,
            })
          }
        }

        if (!map.hasImage(activeIconId)) {
          const activeMarkerImage = await createMapMarkerImage(coverPhotoUrl, true)

          if (cancelled) {
            return
          }

          if (activeMarkerImage && !map.hasImage(activeIconId)) {
            map.addImage(activeIconId, activeMarkerImage.image, {
              pixelRatio: activeMarkerImage.pixelRatio,
            })
          }
        }
      }

      source.setData({
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
          },
        })),
      })
    }

    syncPlaceLayer()

    return () => {
      cancelled = true
    }
  }, [mapReady, visiblePlaces])

  useEffect(() => {
    if (!mapReady || !mapRef.current || !mapRef.current.getLayer(PLACE_LAYER_ID)) {
      return
    }

    mapRef.current.setLayoutProperty(PLACE_LAYER_ID, 'icon-image', [
      'case',
      ['==', ['get', 'id'], selectedPlaceId ?? -1],
      ['get', 'activeIconId'],
      ['get', 'iconId'],
    ])
  }, [mapReady, selectedPlaceId])

  useEffect(() => {
    if (!mapRef.current || !visiblePlaces.length) {
      return
    }

    const bounds = new mapboxgl.LngLatBounds()

    visiblePlaces.forEach((place) => {
      bounds.extend([place.longitude, place.latitude])
    })

    if (!initialViewportAppliedRef.current || activeSearchCode) {
      mapRef.current.fitBounds(bounds, {
        padding: 120,
        maxZoom: visiblePlaces.length === 1 ? 10.5 : 7.8,
        duration: 900,
      })
      initialViewportAppliedRef.current = true
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
