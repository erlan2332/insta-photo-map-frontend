const API_ORIGIN = (import.meta.env.VITE_API_ORIGIN || '').replace(/\/$/, '')
const API_BASE = API_ORIGIN ? `${API_ORIGIN}/api` : '/api'

async function readErrorMessage(response) {
  const fallback = 'Не удалось выполнить запрос к серверу'

  try {
    const payload = await response.json()
    return payload.detail || payload.message || payload.title || fallback
  } catch {
    return fallback
  }
}

export async function fetchMapPlaces(code = '') {
  const params = new URLSearchParams()

  if (code) {
    params.set('code', code)
  }

  const response = await fetch(
    `${API_BASE}/places/map${params.size ? `?${params.toString()}` : ''}`,
  )

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }

  return response.json()
}

export async function fetchMapPlacesPage({
  north,
  south,
  east,
  west,
  page = 0,
  size = 60,
  code = '',
  signal,
}) {
  const params = new URLSearchParams()

  if (code) {
    params.set('code', code)
  } else {
    params.set('north', String(north))
    params.set('south', String(south))
    params.set('east', String(east))
    params.set('west', String(west))
  }

  params.set('page', String(page))
  params.set('size', String(size))

  const response = await fetch(`${API_BASE}/places/map-window?${params.toString()}`, { signal })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }

  return response.json()
}

export async function fetchPlaceById(id, { signal } = {}) {
  const response = await fetch(`${API_BASE}/places/${id}`, { signal })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }

  return response.json()
}

export function resolveMediaUrl(url) {
  if (!url) {
    return ''
  }

  if (/^https?:\/\//.test(url)) {
    return url
  }

  return API_ORIGIN ? `${API_ORIGIN}${url}` : url
}
