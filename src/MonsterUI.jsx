import { marks, rarities, types } from './game'

const baseUrl = import.meta.env.BASE_URL
const placeholder = baseUrl + 'art/srd/unknown.png'

export function MonsterImage({ species, className, alt = '', loading }) {
  return (
    <img
      className={className}
      alt={alt}
      src={species.art ? baseUrl + species.art.replace(/^\.\//, '') : placeholder}
      loading={loading}
      onError={(event) => {
        if (event.currentTarget.getAttribute('src') !== placeholder) event.currentTarget.src = placeholder
      }}
    />
  )
}

export function Type({ type }) {
  return (
    <span className={'type ' + type}>
      {marks[type]} {types[type]}
    </span>
  )
}

export function Rarity({ rarity }) {
  return <span className={'rarity ' + rarity}>{rarities[rarity]}</span>
}

export function LegendaryEncounter({ species, level, hp, onFight, onRetreat }) {
  return (
    <div className="legend-encounter">
      <div className="legend-intro">
        <Rarity rarity="legendary" />
        <h2>전설급 조우</h2>
        <h3>{species.name}</h3>
        <div className="type-list">
          {species.types.map((type) => (
            <Type key={type} type={type} />
          ))}
        </div>
        <p>
          Lv. {level} · {hp} HP
        </p>
        <div className="action-row">
          <button className="legend-fight" onClick={onFight}>
            전투 시작
          </button>
          <button onClick={onRetreat}>후퇴</button>
        </div>
      </div>
      <MonsterImage species={species} className="legend-art" />
    </div>
  )
}
