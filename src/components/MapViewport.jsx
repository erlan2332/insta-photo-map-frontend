import { forwardRef, useImperativeHandle, useRef } from 'react'
import 'mapbox-gl/dist/mapbox-gl.css'
import { usePlaceMap } from '../hooks/usePlaceMap'

const MapViewport = forwardRef(function MapViewport({
  visiblePlaces,
  selectedPlaceId,
  activeSearchCode,
  onPlaceSelect,
  onViewportChange,
}, ref) {
  const mapContainerRef = useRef(null)
  const { focusPlaceOnMap } = usePlaceMap({
    mapContainerRef,
    visiblePlaces,
    selectedPlaceId,
    activeSearchCode,
    onPlaceSelect,
    onViewportChange,
  })

  useImperativeHandle(ref, () => ({
    focusPlaceOnMap,
  }), [focusPlaceOnMap])

  return <div ref={mapContainerRef} className="map-canvas" />
})

export default MapViewport
