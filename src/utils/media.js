const imagePreloadCache = new Set()

export function preloadImage(url) {
  if (!url || imagePreloadCache.has(url)) {
    return
  }

  imagePreloadCache.add(url)

  const image = new Image()
  image.decoding = 'async'
  image.src = url
}
