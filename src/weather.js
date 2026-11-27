export const defaultRegion = 'forest'
export const regions = {
  forest: { id: 'forest', name: '초록숲', city: '서울', latitude: 37.5665, longitude: 126.978, badges: 0 },
  cave: { id: 'cave', name: '석회 동굴', city: '단양', latitude: 36.9845, longitude: 128.3655, badges: 0 },
  sea: { id: 'sea', name: '물안개 바다', city: '제주', latitude: 33.4996, longitude: 126.5312, badges: 1 },
  snow: { id: 'snow', name: '서리 설산', city: '대관령', latitude: 37.6771, longitude: 128.7183, badges: 1 },
  volcano: { id: 'volcano', name: '잿불 화산', city: '서귀포', latitude: 33.3617, longitude: 126.5292, badges: 2 },
  ruins: { id: 'ruins', name: '고대 유적', city: '경주', latitude: 35.8562, longitude: 129.2248, badges: 2 },
}
export const weatherInterval = 15 * 60 * 1000

const weatherGroups = [
  { codes: [0, 1], label: '맑음', icon: '☀', type: 'fire' },
  { codes: [2, 3], label: '구름', icon: '☁', type: null },
  { codes: [45, 48], label: '안개', icon: '≋', type: 'leaf' },
  { codes: [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82], label: '비', icon: '☂', type: 'water' },
  { codes: [71, 73, 75, 77, 85, 86], label: '눈', icon: '❄', type: 'ice' },
  { codes: [95, 96, 99], label: '뇌우', icon: 'ϟ', type: 'water' },
]
const cache = new Map()

export async function fetchWeather(region, signal) {
  const cached = cache.get(region.id)
  if (cached && Date.now() - cached.fetchedAt < weatherInterval) return cached.weather

  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.search = new URLSearchParams({
    latitude: region.latitude,
    longitude: region.longitude,
    current: 'temperature_2m,weather_code',
    timezone: 'Asia/Seoul',
    temperature_unit: 'celsius',
  })
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error('날씨 서버 응답 오류')

  const { current } = await response.json()
  if (
    !Number.isInteger(current?.weather_code) ||
    !Number.isFinite(current?.temperature_2m) ||
    typeof current?.time !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(current.time)
  ) {
    throw new Error('날씨 데이터 형식 오류')
  }
  const condition = weatherGroups.find(({ codes }) => codes.includes(current.weather_code))
  const weather = {
    label: condition?.label ?? '날씨 미분류',
    icon: condition?.icon ?? '☁',
    type: condition?.type ?? null,
    temperature: current.temperature_2m,
    time: current.time.slice(11),
  }
  cache.set(region.id, { fetchedAt: Date.now(), weather })
  return weather
}
