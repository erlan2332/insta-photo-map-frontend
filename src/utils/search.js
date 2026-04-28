export function normalizeCodeQuery(value) {
  return value.replace(/\D/g, '').slice(0, 6)
}
