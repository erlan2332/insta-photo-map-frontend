const imagePreloadCache = new Map()

export function hasPreloadedImage(url) {
  return imagePreloadCache.get(url)?.status === 'loaded'
}

export function getPreloadedImageMetadata(url) {
  return imagePreloadCache.get(url)?.metadata || null
}

export function preloadImage(url) {
  if (!url) {
    return Promise.resolve(false)
  }

  const cachedEntry = imagePreloadCache.get(url)
  if (cachedEntry) {
    return cachedEntry.promise
  }

  const image = new Image()
  let resolvePromise

  const promise = new Promise((resolve) => {
    resolvePromise = resolve
  })

  const entry = {
    status: 'loading',
    promise,
    metadata: null,
  }

  imagePreloadCache.set(url, entry)
  image.decoding = 'async'
  image.onload = () => {
    entry.status = 'loaded'
    entry.metadata = {
      width: image.naturalWidth,
      height: image.naturalHeight,
      aspectRatio: image.naturalHeight ? image.naturalWidth / image.naturalHeight : null,
    }
    resolvePromise(true)
  }
  image.onerror = () => {
    imagePreloadCache.delete(url)
    resolvePromise(false)
  }
  image.src = url

  return promise
}

export async function preloadImageMetadata(url) {
  const loaded = await preloadImage(url)

  if (!loaded) {
    return null
  }

  return getPreloadedImageMetadata(url)
}
