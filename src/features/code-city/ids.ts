export function slugifyCodeCityValue(value: string) {
  return value
    .replaceAll(/[^\w/.-]+/gu, '-')
    .replaceAll('/', '--')
    .replaceAll('.', '-')
    .replaceAll('_', '-')
    .replaceAll(/-+/gu, '-')
    .replaceAll(/^-|-$/gu, '')
    .toLowerCase()
}

export function codeCityBuildingIdForPath(path: string) {
  return `file:${slugifyCodeCityValue(path) || 'root'}`
}
