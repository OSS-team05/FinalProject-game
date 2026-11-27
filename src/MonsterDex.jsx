import { useState } from 'react'
import { gyms, rarities, types } from './game'
import { MonsterImage, Rarity, Type } from './MonsterUI'

const kindNames = {
  aberration: '기괴체',
  celestial: '천상체',
  construct: '구조체',
  dragon: '드래곤',
  elemental: '정령',
  fey: '요정',
  fiend: '마족',
  giant: '거인',
  humanoid: '인간형',
  monstrosity: '괴수',
  undead: '언데드',
  plant: '식물',
}
const rankOptions = { all: '전체', ...rarities }

export default function MonsterDex({ dex, seen, starter, registered, bossClears }) {
  const [query, setQuery] = useState('')
  const [rank, setRank] = useState('all')
  const [type, setType] = useState('all')
  const search = query.trim().toLowerCase()
  const species = Object.values(dex)
  const matches = species.filter(
    (monster) =>
      (rank === 'all' || monster.rarity === rank) &&
      (type === 'all' || monster.types.includes(type)) &&
      [monster.name, monster.originalName, monster.id].some((name) => name.toLowerCase().includes(search)),
  )

  return (
    <section className="panel content-panel">
      <div className="section-title">
        <div>
          <h2>몬스터 도감</h2>
          <p>
            발견 {seen.length}종 · 포획 {registered.length}종 · 보스 격파 {bossClears.length}종
          </p>
        </div>
        <span className="muted" aria-live="polite">
          {matches.length} / {species.length}종
        </span>
      </div>
      <div className="dex-search">
        <div className="dex-search-field">
          <label htmlFor="dex-name">몬스터 이름 검색</label>
          <input
            id="dex-name"
            type="search"
            value={query}
            placeholder="한국어 또는 영어 이름"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="dex-search-field">
          <label htmlFor="dex-type">타입</label>
          <select id="dex-type" value={type} onChange={(event) => setType(event.target.value)}>
            <option value="all">모든 타입</option>
            {Object.entries(types).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="dex-filters" role="group" aria-label="몬스터 등급 필터">
        {Object.entries(rankOptions).map(([id, label]) => (
          <button key={id} aria-pressed={rank === id} onClick={() => setRank(id)}>
            {label}
          </button>
        ))}
      </div>
      {!matches.length && (
        <p className="dex-no-results" role="status">
          일치하는 몬스터가 없습니다.
        </p>
      )}
      {Object.entries(rarities).map(([rarity, label]) => {
        const group = matches.filter((monster) => monster.rarity === rarity)
        if (!group.length) return null
        return (
          <section key={rarity} className={'dex-section ' + rarity} aria-labelledby={'dex-' + rarity}>
            <div className="dex-group-title">
              <h3 id={'dex-' + rarity}>{label} 몬스터</h3>
              <span>{group.length}종</span>
            </div>
            <div className="dex-grid">
              {group.map((monster) => {
                const cleared = bossClears.includes(monster.id)
                const caught = registered.includes(monster.id)
                const discovered = seen.includes(monster.id)
                const status = cleared
                  ? '격파 완료'
                  : caught
                    ? '포획 완료'
                    : monster.id === starter
                      ? '시작 동료'
                      : discovered
                        ? '발견 · 미포획'
                        : '미발견'
                return (
                  <article key={monster.id} className="dex-card">
                    <div className="dex-card-overview">
                      <MonsterImage species={monster} className="dex-art" loading="lazy" />
                      <div>
                        <h4>{monster.name}</h4>
                        <p className="dex-original-name">{monster.originalName}</p>
                        <div className="type-list">
                          {monster.types.map((element) => (
                            <Type key={element} type={element} />
                          ))}
                        </div>
                      </div>
                    </div>
                    <p className="dex-hp">
                      기본 HP {monster.hp} · CR {monster.cr}
                    </p>
                    <div className="dex-card-status">
                      <Rarity rarity={rarity} />
                      <span className={caught || cleared ? 'dex-registered' : 'muted'}>{status}</span>
                    </div>
                    <details>
                      <summary>원본 정보와 기술</summary>
                      <p>
                        {kindNames[monster.kind] ?? monster.kind} · 원본 HP {monster.rawHp}
                      </p>
                      <ul className="dex-moves">
                        {monster.moves.map((move) => (
                          <li key={move.id}>
                            <strong>{move.name}</strong> <Type type={move.type} />
                            <p>{move.damage.map((part) => `${part.dice} ${part.name}`).join(' + ')}</p>
                            <p>
                              ⚄ {move.min}–{move.max} · PP {move.maxPp} · Lv. {move.unlockLevel}
                            </p>
                          </li>
                        ))}
                      </ul>
                      {monster.unlockBadges > 0 && (
                        <p>
                          {gyms[monster.unlockBadges - 1].badge} 획득 후 {rarity === 'boss' ? '도전' : '등장'}
                        </p>
                      )}
                    </details>
                  </article>
                )
              })}
            </div>
          </section>
        )
      })}
    </section>
  )
}
