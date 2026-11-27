import { marks, types } from './game'
import { regions } from './weather'

export default function WeatherPanel({ region, weather, badges, onRegion, onRetry }) {
  const forecast = weather?.data

  return (
    <section className="panel weather-panel">
      <h2>지역 날씨</h2>
      <div className="weather-location">
        <label htmlFor="weather-region">탐험 지역</label>
        <select id="weather-region" value={region.id} onChange={(event) => onRegion(event.target.value)}>
          {Object.values(regions).map((area) => (
            <option key={area.id} value={area.id} disabled={area.badges > badges}>
              {area.name} · {area.city}
              {area.badges > badges && ` (배지 ${area.badges}개 필요)`}
            </option>
          ))}
        </select>
      </div>
      <div className="weather-readout" aria-live="polite" aria-atomic="true">
        {forecast ? (
          <>
            <div className="weather-current">
              <span className="weather-symbol" aria-hidden="true">
                {forecast.icon}
              </span>
              <strong>{forecast.label}</strong>
              <span className="temperature">{forecast.temperature} °C</span>
            </div>
            <p className="weather-effect">
              {forecast.type ? (
                <>
                  {marks[forecast.type]} {types[forecast.type]} 타입의 등장 가중치 2배
                </>
              ) : (
                '기본 등장 확률 적용 중'
              )}
            </p>
            <p className="weather-time">한국시간 {forecast.time} 기준</p>
          </>
        ) : (
          <>
            <p>{weather?.failed ? '날씨를 불러오지 못했습니다.' : '날씨를 불러오는 중…'}</p>
            <p className="weather-effect">기본 등장 확률 적용 중</p>
          </>
        )}
      </div>
      {weather?.failed && (
        <button className="weather-retry" onClick={onRetry}>
          날씨 다시 불러오기
        </button>
      )}
      <p className="weather-credit">
        날씨 데이터 <a href="https://open-meteo.com/">Open-Meteo</a> ·{' '}
        <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>
        <span>날씨 코드를 번역하고 게임 타입으로 분류했습니다.</span>
      </p>
    </section>
  )
}
