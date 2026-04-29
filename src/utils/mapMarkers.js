function roundedRect(context, x, y, width, height, radius) {
  context.beginPath()
  context.moveTo(x + radius, y)
  context.lineTo(x + width - radius, y)
  context.quadraticCurveTo(x + width, y, x + width, y + radius)
  context.lineTo(x + width, y + height - radius)
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  context.lineTo(x + radius, y + height)
  context.quadraticCurveTo(x, y + height, x, y + height - radius)
  context.lineTo(x, y + radius)
  context.quadraticCurveTo(x, y, x + radius, y)
  context.closePath()
}

const externalImageCache = new Map()
const markerImagesCache = new Map()
let clusterMarkerImageCache = null
const MARKER_CACHE_LIMIT = 180

function rememberCacheEntry(cache, key, value) {
  if (cache.has(key)) {
    cache.delete(key)
  }

  cache.set(key, value)

  while (cache.size > MARKER_CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value
    cache.delete(oldestKey)
  }
}

function loadExternalImage(url) {
  if (!url) {
    return Promise.resolve(null)
  }

  const cachedPromise = externalImageCache.get(url)
  if (cachedPromise) {
    return cachedPromise
  }

  const imagePromise = new Promise((resolve) => {
    const image = new Image()

    image.crossOrigin = 'anonymous'
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = url
  })

  rememberCacheEntry(externalImageCache, url, imagePromise)
  return imagePromise
}

function renderMapMarkerImage(image, active) {
  const pixelRatio = 2
  const width = 48 * pixelRatio
  const height = 66 * pixelRatio
  const thumbSize = 40 * pixelRatio
  const thumbX = (width - thumbSize) / 2
  const thumbY = 3 * pixelRatio
  const pointerSize = 11 * pixelRatio

  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  canvas.width = width
  canvas.height = height

  if (!context) {
    return null
  }

  context.clearRect(0, 0, width, height)

  if (active) {
    context.save()
    context.shadowColor = 'rgba(255, 203, 118, 0.36)'
    context.shadowBlur = 18 * pixelRatio
    context.shadowOffsetY = 12 * pixelRatio
    context.beginPath()
    context.arc(width / 2, 23 * pixelRatio, 22 * pixelRatio, 0, Math.PI * 2)
    context.fillStyle = 'rgba(255, 203, 118, 0.18)'
    context.fill()
    context.restore()
  }

  context.save()
  context.shadowColor = 'rgba(8, 13, 18, 0.3)'
  context.shadowBlur = 14 * pixelRatio
  context.shadowOffsetY = 9 * pixelRatio
  roundedRect(context, thumbX, thumbY, thumbSize, thumbSize, 14 * pixelRatio)
  context.fillStyle = '#ffffff'
  context.fill()
  context.restore()

  roundedRect(context, thumbX, thumbY, thumbSize, thumbSize, 14 * pixelRatio)
  context.fillStyle = '#ffffff'
  context.fill()

  context.save()
  roundedRect(
    context,
    thumbX + 2 * pixelRatio,
    thumbY + 2 * pixelRatio,
    thumbSize - 4 * pixelRatio,
    thumbSize - 4 * pixelRatio,
    12 * pixelRatio,
  )
  context.clip()

  if (image) {
    const innerSize = thumbSize - 4 * pixelRatio
    const scale = Math.max(innerSize / image.naturalWidth, innerSize / image.naturalHeight)
    const drawWidth = image.naturalWidth * scale
    const drawHeight = image.naturalHeight * scale
    const drawX = thumbX + 2 * pixelRatio + (innerSize - drawWidth) / 2
    const drawY = thumbY + 2 * pixelRatio + (innerSize - drawHeight) / 2

    context.drawImage(image, drawX, drawY, drawWidth, drawHeight)

    const overlayGradient = context.createLinearGradient(0, thumbY + 2 * pixelRatio, 0, thumbY + thumbSize)
    overlayGradient.addColorStop(0, 'rgba(255, 255, 255, 0.18)')
    overlayGradient.addColorStop(0.45, 'rgba(255, 255, 255, 0)')
    overlayGradient.addColorStop(1, 'rgba(8, 13, 18, 0.14)')
    context.fillStyle = overlayGradient
    context.fillRect(
      thumbX + 2 * pixelRatio,
      thumbY + 2 * pixelRatio,
      thumbSize - 4 * pixelRatio,
      thumbSize - 4 * pixelRatio,
    )
  } else {
    const fallbackGradient = context.createLinearGradient(thumbX, thumbY, thumbX + thumbSize, thumbY + thumbSize)
    fallbackGradient.addColorStop(0, '#dce9ee')
    fallbackGradient.addColorStop(1, '#89a8b7')
    context.fillStyle = fallbackGradient
    context.fillRect(
      thumbX + 2 * pixelRatio,
      thumbY + 2 * pixelRatio,
      thumbSize - 4 * pixelRatio,
      thumbSize - 4 * pixelRatio,
    )
  }

  context.restore()

  context.save()
  context.translate(width / 2, height - 13 * pixelRatio)
  context.rotate(Math.PI / 4)
  context.fillStyle = '#ffffff'
  context.fillRect(-pointerSize / 2, -pointerSize / 2, pointerSize, pointerSize)
  context.restore()

  context.beginPath()
  context.arc(width / 2, height - 11 * pixelRatio, 5.5 * pixelRatio, 0, Math.PI * 2)
  context.fillStyle = active ? '#ffd687' : '#1f7a4d'
  context.fill()

  context.beginPath()
  context.arc(width / 2, height - 11 * pixelRatio, 2 * pixelRatio, 0, Math.PI * 2)
  context.fillStyle = '#ffffff'
  context.fill()

  if (active) {
    context.strokeStyle = '#ffd687'
    context.lineWidth = 3 * pixelRatio
    roundedRect(
      context,
      thumbX + 1.5 * pixelRatio,
      thumbY + 1.5 * pixelRatio,
      thumbSize - 3 * pixelRatio,
      thumbSize - 3 * pixelRatio,
      13 * pixelRatio,
    )
    context.stroke()
  }

  return {
    image: context.getImageData(0, 0, width, height),
    pixelRatio,
  }
}

function renderClusterMarkerImage() {
  const pixelRatio = 2
  const width = 48 * pixelRatio
  const height = 66 * pixelRatio
  const thumbSize = 40 * pixelRatio
  const thumbX = (width - thumbSize) / 2
  const thumbY = 3 * pixelRatio
  const pointerSize = 11 * pixelRatio

  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  canvas.width = width
  canvas.height = height

  if (!context) {
    return null
  }

  context.clearRect(0, 0, width, height)

  context.save()
  context.shadowColor = 'rgba(8, 13, 18, 0.3)'
  context.shadowBlur = 14 * pixelRatio
  context.shadowOffsetY = 9 * pixelRatio
  roundedRect(context, thumbX, thumbY, thumbSize, thumbSize, 14 * pixelRatio)
  context.fillStyle = '#ffffff'
  context.fill()
  context.restore()

  roundedRect(context, thumbX, thumbY, thumbSize, thumbSize, 14 * pixelRatio)
  context.fillStyle = '#ffffff'
  context.fill()

  context.save()
  roundedRect(
    context,
    thumbX + 2 * pixelRatio,
    thumbY + 2 * pixelRatio,
    thumbSize - 4 * pixelRatio,
    thumbSize - 4 * pixelRatio,
    12 * pixelRatio,
  )
  context.clip()

  const innerGradient = context.createLinearGradient(thumbX, thumbY, thumbX + thumbSize, thumbY + thumbSize)
  innerGradient.addColorStop(0, '#265d8f')
  innerGradient.addColorStop(0.5, '#236f74')
  innerGradient.addColorStop(1, '#1f7a4d')
  context.fillStyle = innerGradient
  context.fillRect(
    thumbX + 2 * pixelRatio,
    thumbY + 2 * pixelRatio,
    thumbSize - 4 * pixelRatio,
    thumbSize - 4 * pixelRatio,
  )

  const overlayGradient = context.createLinearGradient(0, thumbY + 2 * pixelRatio, 0, thumbY + thumbSize)
  overlayGradient.addColorStop(0, 'rgba(255, 255, 255, 0.18)')
  overlayGradient.addColorStop(0.45, 'rgba(255, 255, 255, 0)')
  overlayGradient.addColorStop(1, 'rgba(8, 13, 18, 0.14)')
  context.fillStyle = overlayGradient
  context.fillRect(
    thumbX + 2 * pixelRatio,
    thumbY + 2 * pixelRatio,
    thumbSize - 4 * pixelRatio,
    thumbSize - 4 * pixelRatio,
  )
  context.restore()

  context.save()
  context.translate(width / 2, height - 13 * pixelRatio)
  context.rotate(Math.PI / 4)
  context.fillStyle = '#ffffff'
  context.fillRect(-pointerSize / 2, -pointerSize / 2, pointerSize, pointerSize)
  context.restore()

  context.beginPath()
  context.arc(width / 2, height - 11 * pixelRatio, 5.5 * pixelRatio, 0, Math.PI * 2)
  context.fillStyle = '#236f74'
  context.fill()

  context.beginPath()
  context.arc(width / 2, height - 11 * pixelRatio, 2 * pixelRatio, 0, Math.PI * 2)
  context.fillStyle = '#ffffff'
  context.fill()

  return {
    image: context.getImageData(0, 0, width, height),
    pixelRatio,
  }
}

export async function createMapMarkerImages(url) {
  const cacheKey = url || '__empty__'
  const cachedPromise = markerImagesCache.get(cacheKey)

  if (cachedPromise) {
    return cachedPromise
  }

  const markerPromise = loadExternalImage(url).then((image) => ({
    normal: renderMapMarkerImage(image, false),
    active: renderMapMarkerImage(image, true),
  }))

  rememberCacheEntry(markerImagesCache, cacheKey, markerPromise)
  return markerPromise
}

export function createClusterMarkerImage() {
  if (!clusterMarkerImageCache) {
    clusterMarkerImageCache = renderClusterMarkerImage()
  }

  return clusterMarkerImageCache
}
