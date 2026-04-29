const imagePreloadCache = new Map()

export function hasPreloadedImage(url) {
  return imagePreloadCache.get(url)?.status === 'loaded'
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
  }

  imagePreloadCache.set(url, entry)
  image.decoding = 'async'
  image.onload = () => {
    entry.status = 'loaded'
    resolvePromise(true)
  }
  image.onerror = () => {
    imagePreloadCache.delete(url)
    resolvePromise(false)
  }
  image.src = url

  return promise
}
