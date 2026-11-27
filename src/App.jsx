import { useEffect, useState } from 'react'
import Classic from './Classic'
import MonsterDex from './MonsterDex'
import { LegendaryEncounter, MonsterImage, Rarity, Type } from './MonsterUI'
import WeatherPanel from './WeatherPanel'
import {
  attack,
  bosses,
  captureThreshold,
  catchChance,
  canUseMove,
  encounterLevel,
  fullPp,
  gyms,
  items,
  makeMonster,
  marks,
  maxHp,
  neededXp,
  pickWild,
  remainingPp,
  reward,
  roll,
  starters,
} from './game'
import { defaultRegion, fetchWeather, regions, weatherInterval } from './weather'
import { catalogIsFresh, fetchCatalog, monsterCount, readCatalogCache } from './srd'

const storageKey = 'dice-wild-srd-v2'
const legacyKey = 'dice-wild-v1'
const newGame = () => ({
  starter: null,
  team: [],
  active: null,
  coins: 40,
  bag: { heal: 2, pp: 1, power: 1, capsule: 3 },
  badges: [],
  boost: 0,
  battle: null,
  region: defaultRegion,
  seen: [],
  registered: [],
  bossClears: [],
})
const tabs = [
  ['field', '♧', '탐험'],
  ['team', '♙', '팀 관리'],
  ['dex', '▤', '도감'],
  ['gyms', '⚑', '체육관'],
  ['shop', '◇', '상점'],
  ['classic', '⚄', '클래식'],
]
const legendOutcomes = {
  victory: '전설급 격파',
  captured: '전설급 포획 성공',
  defeat: '전설급 전투 패배',
  fled: '전설급 몬스터 도주',
  retreated: '전설급 조우에서 후퇴',
}

function loadGame() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey))
    if (!Array.isArray(saved?.team)) return newGame()
    return { ...newGame(), ...saved }
  } catch {
    return newGame()
  }
}

function hasLegacyGame() {
  try {
    return Boolean(JSON.parse(localStorage.getItem(legacyKey))?.starter)
  } catch {
    return false
  }
}

const record = (list, id) => (list.includes(id) ? list : [...list, id])

function Health({ monster, species }) {
  const max = maxHp(species, monster.level)
  return (
    <div className="health" aria-label={`HP ${monster.hp} / ${max}`}>
      <div>
        <span>HP</span>
        <span>
          {monster.hp} / {max}
        </span>
      </div>
      <progress max={max} value={monster.hp} />
    </div>
  )
}

function Monster({ monster, species, side }) {
  return (
    <div className={'combatant ' + side}>
      <div className="combat-name">
        <strong>{species.name}</strong>
        <span>Lv. {monster.level}</span>
      </div>
      <div className="type-list">
        {species.rarity !== 'common' && <Rarity rarity={species.rarity} />}
        {species.types.map((type) => (
          <Type key={type} type={type} />
        ))}
      </div>
      <Health monster={monster} species={species} />
      <MonsterImage species={species} className="combat-art" alt={species.name} />
    </div>
  )
}

function App() {
  const [game, setGame] = useState(loadGame)
  const [catalog, setCatalog] = useState(() => {
    const cache = readCatalogCache()
    return { dex: cache?.dex ?? null, status: cache ? 'cache' : 'loading' }
  })
  const [legacyGame] = useState(hasLegacyGame)
  const [retry, setRetry] = useState(0)
  const [tab, setTab] = useState('field')
  const [choice, setChoice] = useState(starters[0])
  const [notice, setNotice] = useState('')
  const [saveError, setSaveError] = useState(false)
  const [weather, setWeather] = useState(null)
  const [weatherAttempt, setWeatherAttempt] = useState(0)
  const region = regions[game.region] ?? regions[defaultRegion]
  const regionWeather = weather?.region === region.id ? weather : null
  const dex = catalog.dex
  const catalogSize = Object.keys(dex ?? {}).length

  useEffect(() => {
    const cache = readCatalogCache()
    if (!retry && catalogIsFresh(cache)) return
    const controller = new AbortController()
    let current = true
    const timeout = setTimeout(() => controller.abort(), 25000)
    setCatalog((previous) => ({ ...previous, status: 'loading' }))
    fetchCatalog(cache, controller.signal)
      .then((result) => {
        if (current)
          setCatalog((previous) => ({
            dex: { ...previous.dex, ...result.dex },
            status: result.live ? 'live' : 'partial',
            received: result.received,
          }))
      })
      .catch((error) => {
        const message = error.message?.startsWith('D&D API') ? error.message : 'D&D API 연결에 실패했습니다.'
        if (current) setCatalog((previous) => ({ ...previous, status: 'failed', message }))
      })
      .finally(() => clearTimeout(timeout))
    return () => {
      current = false
      clearTimeout(timeout)
      controller.abort()
    }
  }, [retry])

  useEffect(() => {
    const controller = new AbortController()
    let current = true
    let refresh
    const timeout = setTimeout(() => controller.abort(), 8000)

    fetchWeather(region, controller.signal)
      .then((data) => {
        if (current) setWeather({ region: region.id, data })
      })
      .catch(() => {
        if (current) setWeather({ region: region.id, failed: true })
      })
      .finally(() => {
        clearTimeout(timeout)
        if (current) refresh = setTimeout(() => setWeatherAttempt((attempt) => attempt + 1), weatherInterval)
      })

    return () => {
      current = false
      clearTimeout(timeout)
      clearTimeout(refresh)
      controller.abort()
    }
  }, [region, weatherAttempt])

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(game))
      setSaveError(false)
    } catch {
      setSaveError(true)
    }
  }, [game])

  const active = game.team.find((monster) => monster.uid === game.active)
  const battle = game.battle
  const inBattle = Boolean(battle && !battle.ended)
  const species = active && dex?.[active.species]
  const foeSpecies = battle && dex?.[battle.foe.species]
  const startersReady = starters.filter((id) => dex?.[id])
  const unavailableSave = Boolean(game.team.some((member) => !dex?.[member.species]) || (battle && !foeSpecies))
  const chosenStarter = startersReady.includes(choice) ? choice : startersReady[0]
  const retryCatalog = () => setRetry((attempt) => attempt + 1)
  const isWild = battle?.gymIndex === null && !battle.bossId
  const isLegendary = foeSpecies?.rarity === 'legendary'
  const isArrival = inBattle && battle.phase === 'arrival'
  const canCapture = Boolean(
    inBattle &&
    isWild &&
    !isArrival &&
    foeSpecies &&
    foeSpecies.rarity !== 'boss' &&
    battle.foe.hp > 0 &&
    battle.foe.hp <= maxHp(foeSpecies, battle.foe.level) * captureThreshold,
  )

  function updateActive(next, changes = {}) {
    setGame({
      ...game,
      ...changes,
      team: (changes.team ?? game.team).map((monster) => (monster.uid === next.uid ? next : monster)),
    })
  }

  function start() {
    const starter = chosenStarter
    if (!starter) return
    const monster = makeMonster(dex[starter])
    setGame({
      ...game,
      starter,
      team: [monster],
      active: monster.uid,
      seen: record(game.seen, starter),
    })
    setNotice(`첫 동료와 함께 ${region.name}을 탐험해 보세요.`)
  }

  function beginBattle(target, level, { gymIndex = null, bossId = null } = {}) {
    if (inBattle || !active?.hp) return
    setGame({
      ...game,
      seen: record(game.seen, target.id),
      battle: {
        gymIndex,
        bossId,
        stage: 0,
        foe: makeMonster(target, level),
        phase: target.rarity === 'legendary' ? 'arrival' : null,
        log: [`${target.name} 등장!`],
      },
    })
    setNotice('')
    setTab('field')
  }

  function explore() {
    const target = pickWild(dex, region.id, game.badges.length, regionWeather?.data?.type)
    if (!target) {
      setNotice(
        '이 지역에서 사용할 수 있는 몬스터 데이터가 없습니다. 도감을 다시 불러오거나 다른 지역을 선택하세요.',
      )
      return
    }
    beginBattle(target, encounterLevel(target, game.badges.length))
  }

  function challengeGym(gymIndex) {
    if (gymIndex !== game.badges.length) return
    const gym = gyms[gymIndex]
    if (!gym.foes.every((id) => dex[id])) return
    beginBattle(dex[gym.foes[0]], gym.level, { gymIndex })
  }

  function challengeBoss(boss) {
    const target = dex[boss.id]
    if (
      !target ||
      game.badges.length < target.unlockBadges ||
      game.bossClears.includes(boss.id) ||
      (boss.final && game.bossClears.length < bosses.length - 1)
    )
      return
    beginBattle(target, boss.level, { bossId: boss.id })
  }

  function retreat() {
    if (isLegendary) {
      setGame({
        ...game,
        battle: { ...battle, phase: null, ended: true, result: 'retreated', log: ['후퇴했습니다.'] },
      })
      return
    }
    setGame({ ...game, battle: null })
    setNotice(isWild ? '야생 전투에서 물러났습니다.' : `${battle.bossId ? '보스' : '체육관'} 도전을 종료했습니다.`)
  }

  function counter(foe, player, log) {
    const target = dex[foe.species]
    const available = target.moves.filter((move) => canUseMove(foe, move))
    if (!available.length) return { foe, player, log: [...log, `${target.name}에게 남은 PP가 없습니다.`] }
    const move = available[roll(0, available.length - 1)]
    const result = attack(move, species.types)
    return {
      foe: { ...foe, pp: { ...foe.pp, [move.id]: remainingPp(foe, move) - 1 } },
      player: { ...player, hp: Math.max(0, player.hp - result.damage) },
      log: [...log, describe(target.name, move, result)],
    }
  }

  function describe(name, move, result) {
    return `${name} · ${move.name} · ⚄ ${result.value}${result.boost ? ' +' + result.boost : ''} × ${result.multiplier} → 피해 ${result.damage}`
  }

  function win(player, foe, log, { changes = {}, lastRoll = null, result = 'victory' } = {}) {
    const gym = battle.gymIndex === null ? null : gyms[battle.gymIndex]
    const amount = 7 + foe.level * 4 + (battle.bossId || isLegendary ? 12 : 0)
    const grown = reward(player, amount, species)
    log = [...log, `경험치 +${amount}${grown.level > player.level ? ' · 레벨 ' + grown.level + ' 달성!' : ''}`]
    for (const move of species.moves.filter(
      (move) => move.unlockLevel > player.level && move.unlockLevel <= grown.level,
    )) {
      log.push(`기술 해금 · ${move.name}`)
    }
    if (gym && battle.stage + 1 < gym.foes.length) {
      const next = dex[gym.foes[battle.stage + 1]]
      updateActive(grown, {
        ...changes,
        seen: record(game.seen, next.id),
        battle: {
          ...battle,
          foe: makeMonster(next, gym.level + 1),
          stage: battle.stage + 1,
          log: [...log, `${next.name} 등장!`],
          lastRoll,
        },
      })
      return
    }
    const coins = gym ? 65 : 12 + foe.level * 3 + (battle.bossId || isLegendary ? 35 : 0)
    const rewardLabel = result === 'captured' ? '포획 보상' : '승리'
    updateActive(grown, {
      ...changes,
      coins: game.coins + coins,
      badges: gym ? [...game.badges, gym.badge] : game.badges,
      bossClears: battle.bossId ? [...game.bossClears, battle.bossId] : game.bossClears,
      battle: {
        ...battle,
        foe,
        ended: true,
        result,
        lastRoll,
        log: [...log, `${rewardLabel}! +${coins} 코인${gym ? ' · ' + gym.badge : ''}`],
      },
    })
  }

  function takeTurn(move) {
    if (!inBattle || isArrival || !active.hp || !canUseMove(active, move)) return
    const result = attack(move, foeSpecies.types, game.boost)
    const foe = { ...battle.foe, hp: Math.max(0, battle.foe.hp - result.damage) }
    const player = { ...active, pp: { ...active.pp, [move.id]: remainingPp(active, move) - 1 } }
    const log = [describe(species.name, move, result)]
    if (!foe.hp) {
      win(player, foe, log, { changes: { boost: 0 }, lastRoll: result.value })
      return
    }
    const next = counter(foe, player, log)
    updateActive(next.player, {
      boost: 0,
      battle: {
        ...battle,
        foe: next.foe,
        lastRoll: result.value,
        ended: next.player.hp === 0,
        result: next.player.hp ? null : 'defeat',
        log: next.player.hp ? next.log : [...next.log, '패배했습니다. 캠프에서 회복할 수 있습니다.'],
      },
    })
  }

  function capture(boosted) {
    if (!canCapture || (boosted && !game.bag.capsule)) return
    const bag = boosted ? { ...game.bag, capsule: game.bag.capsule - 1 } : game.bag
    if (Math.random() < catchChance(battle.foe, foeSpecies, boosted)) {
      const captured = { ...battle.foe, pp: fullPp(foeSpecies) }
      win(active, battle.foe, [`${foeSpecies.name} 포획 성공!`], {
        result: 'captured',
        changes: { bag, team: [...game.team, captured], registered: record(game.registered, foeSpecies.id) },
      })
      return
    }
    if (Math.random() < 0.18) {
      setGame({
        ...game,
        bag,
        battle: { ...battle, ended: true, result: 'fled', log: ['포획 실패! 야생 몬스터가 도망쳤습니다.'] },
      })
      return
    }
    const next = counter(battle.foe, active, ['포획 실패!'])
    updateActive(next.player, {
      bag,
      battle: {
        ...battle,
        foe: next.foe,
        ended: !next.player.hp,
        result: next.player.hp ? null : 'defeat',
        log: next.player.hp ? next.log : [...next.log, '패배했습니다.'],
      },
    })
  }

  function applyItem(key) {
    if (!active || !game.bag[key]) return
    if (key === 'power' && game.boost) return
    if (key === 'heal' && active.hp === maxHp(species, active.level)) return
    if (key === 'pp' && species.moves.every((move) => remainingPp(active, move) === move.maxPp)) return
    const next = { ...active }
    if (key === 'heal') next.hp = Math.min(maxHp(species, next.level), next.hp + 20)
    if (key === 'pp')
      next.pp = Object.fromEntries(
        species.moves.map((move) => [move.id, Math.min(move.maxPp, remainingPp(next, move) + 5)]),
      )
    updateActive(next, { bag: { ...game.bag, [key]: game.bag[key] - 1 }, boost: key === 'power' ? 3 : game.boost })
    setNotice(`${items[key].name} 사용 완료.`)
  }

  function buy(key) {
    if (game.coins < items[key].price) return
    setGame({ ...game, coins: game.coins - items[key].price, bag: { ...game.bag, [key]: game.bag[key] + 1 } })
    setNotice(`${items[key].name}을(를) 구매했습니다.`)
  }

  function rest() {
    if (inBattle) return
    setGame({
      ...game,
      team: game.team.map((monster) => {
        const data = dex[monster.species]
        return { ...monster, hp: maxHp(data, monster.level), pp: fullPp(data) }
      }),
      battle: null,
    })
    setNotice('모든 동료의 HP와 PP를 회복했습니다.')
  }

  function reset() {
    if (!window.confirm('D&D판 모험을 초기화하고 새 게임을 시작할까요?')) return
    setGame(newGame())
    setTab('field')
    setChoice(starters[0])
    setNotice('')
  }

  let content
  if (tab === 'classic') content = <Classic />
  else if (dex && tab === 'dex')
    content = (
      <MonsterDex
        dex={dex}
        seen={game.seen}
        starter={game.starter}
        registered={game.registered}
        bossClears={game.bossClears}
      />
    )
  else if (!dex || unavailableSave || (!active && !startersReady.length))
    content = (
      <section className="panel content-panel catalog-empty">
        <h2>몬스터 도감 연결</h2>
        <div role="status">
          <p>
            {catalog.status === 'loading'
              ? 'D&D 5e API에서 몬스터를 불러오는 중…'
              : unavailableSave && dex
                ? '저장된 모험에 필요한 몬스터 데이터가 없습니다. 연결을 다시 확인하세요.'
                : (catalog.message ?? '시작 동료 데이터를 불러오지 못했습니다.')}
          </p>
          {legacyGame && <p>기존 버전의 저장 기록은 브라우저에 보존돼 있습니다.</p>}
        </div>
        {catalog.status !== 'loading' && (
          <button className="primary" onClick={retryCatalog}>
            다시 시도
          </button>
        )}
      </section>
    )
  else if (!active)
    content = (
      <section className="panel starter">
        <div className="section-title">
          <div>
            <h2>첫 동료를 선택하세요</h2>
            <p>
              {legacyGame
                ? '이전 모험의 저장은 보존했습니다. D&D판 모험에서 첫 동료를 고르세요.'
                : '함께 모험을 떠날 몬스터를 골라 주세요.'}
            </p>
          </div>
          <span className="muted">Lv. 01</span>
        </div>
        <div className="starter-grid" aria-label="첫 동료">
          {startersReady.map((key) => {
            const data = dex[key]
            return (
              <button
                key={key}
                className={`starter-card ${data.types[0]} ${chosenStarter === key ? 'selected' : ''}`}
                onClick={() => setChoice(key)}
                aria-pressed={chosenStarter === key}
              >
                <span className="card-top">
                  <span>CR {data.cr}</span>
                  <span className="selector">{chosenStarter === key ? '✓' : ''}</span>
                </span>
                <span className="sprite-stage">
                  <MonsterImage species={data} />
                </span>
                <strong>{data.name}</strong>
                <span className="card-foot">
                  <Type type={data.types[0]} />
                  <span>♥ {data.hp} HP</span>
                </span>
              </button>
            )
          })}
        </div>
        <div className="starter-actions">
          <button className="primary" onClick={start}>
            모험 시작 <span>→</span>
          </button>
        </div>
      </section>
    )
  else if (tab === 'team')
    content = (
      <section className="panel content-panel">
        <div className="section-title">
          <div>
            <h2>팀 관리</h2>
            <p>동료의 성장과 기술을 확인하세요.</p>
          </div>
          <span className="muted">{game.team.length}마리</span>
        </div>
        <div className="team-list">
          {game.team.map((monster) => {
            const data = dex[monster.species]
            return (
              <article key={monster.uid} className="team-card">
                <MonsterImage species={data} className="team-art" />
                <div>
                  <h3>
                    {data.name} <small>Lv. {monster.level}</small>
                  </h3>
                  <div className="type-list">
                    {data.rarity !== 'common' && <Rarity rarity={data.rarity} />}
                    {data.types.map((type) => (
                      <Type key={type} type={type} />
                    ))}
                  </div>
                  <Health monster={monster} species={data} />
                  <p>
                    경험치 {monster.xp} / {neededXp(monster.level)}
                  </p>
                </div>
                <ul>
                  {data.moves.map((move) => (
                    <li key={move.id}>
                      {move.name}{' '}
                      <span>
                        {monster.level < move.unlockLevel
                          ? `Lv. ${move.unlockLevel} 해금`
                          : `PP ${remainingPp(monster, move)} / ${move.maxPp}`}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="team-actions">
                  <button
                    disabled={inBattle || monster.uid === game.active || !monster.hp}
                    onClick={() => {
                      setGame({ ...game, active: monster.uid, battle: null })
                      setNotice(`${data.name} 전투 동료로 선택.`)
                    }}
                  >
                    {monster.uid === game.active ? '전투 동료' : '전투 동료로 선택'}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      </section>
    )
  else if (tab === 'gyms')
    content = (
      <section className="panel content-panel">
        <div className="section-title">
          <div>
            <h2>체육관</h2>
            <p>두 상대를 연속으로 이기면 배지를 얻습니다.</p>
          </div>
          <span className="muted">{game.badges.length} / 3</span>
        </div>
        <div className="stack">
          {gyms.map((gym, index) => (
            <article key={gym.name} className="row-card">
              <div className="item-icon">{marks[gym.type]}</div>
              <div>
                <h3>{gym.name}</h3>
                <Type type={gym.type} />
                <p>
                  Lv. {gym.level}–{gym.level + 1} · {gym.badge}
                </p>
              </div>
              <button
                disabled={
                  inBattle || index !== game.badges.length || !active.hp || !gym.foes.every((id) => dex[id])
                }
                onClick={() => challengeGym(index)}
              >
                {index < game.badges.length
                  ? '클리어'
                  : index > game.badges.length
                    ? '잠김'
                    : gym.foes.every((id) => dex[id])
                      ? '도전하기'
                      : '데이터 확인 필요'}
              </button>
            </article>
          ))}
        </div>
        <div className="section-title boss-title">
          <div>
            <h2>보스 도전</h2>
            <p>배지를 획득하면 새로운 보스에 도전할 수 있습니다.</p>
          </div>
          <span className="muted">
            {game.bossClears.length} / {bosses.length} 격파
          </span>
        </div>
        <div className="stack">
          {bosses.map((boss) => {
            const target = dex[boss.id]
            if (!target) return null
            const cleared = game.bossClears.includes(boss.id)
            const locked = game.badges.length < target.unlockBadges
            const finalLocked = boss.final && game.bossClears.length < bosses.length - 1
            return (
              <article key={boss.id} className="row-card boss-card">
                <MonsterImage species={target} className="boss-art" />
                <div>
                  <h3>{target.name}</h3>
                  <div className="type-list">
                    {target.types.map((type) => (
                      <Type key={type} type={type} />
                    ))}
                  </div>
                  <p>
                    Lv. {boss.level} · CR {target.cr}
                    {boss.final && ' · 최종 보스'}
                  </p>
                </div>
                <button
                  disabled={inBattle || cleared || locked || finalLocked || !active.hp}
                  onClick={() => challengeBoss(boss)}
                >
                  {cleared
                    ? '격파 완료'
                    : locked
                      ? `배지 ${target.unlockBadges}개 필요`
                      : finalLocked
                        ? '보스 5마리 격파 필요'
                        : '보스 도전하기'}
                </button>
              </article>
            )
          })}
        </div>
      </section>
    )
  else if (tab === 'shop')
    content = (
      <section className="panel content-panel">
        <div className="section-title">
          <div>
            <h2>모험 상점</h2>
            <p>코인으로 모험에 필요한 아이템을 구매하세요.</p>
          </div>
          <span className="coins">◈ {game.coins}</span>
        </div>
        <div className="stack">
          {Object.entries(items).map(([key, item]) => (
            <article key={key} className="row-card">
              <div className="item-icon">{item.icon}</div>
              <div>
                <h3>{item.name}</h3>
                <p>
                  {item.description} · {game.bag[key]}개 보유
                </p>
              </div>
              <button disabled={game.coins < item.price} onClick={() => buy(key)}>
                ◈ {item.price} 구매
              </button>
              {key !== 'capsule' && (
                <button
                  disabled={
                    !game.bag[key] ||
                    (key === 'power' && !!game.boost) ||
                    (key === 'heal' && active.hp === maxHp(species, active.level)) ||
                    (key === 'pp' && species.moves.every((move) => remainingPp(active, move) === move.maxPp))
                  }
                  onClick={() => applyItem(key)}
                >
                  사용
                </button>
              )}
            </article>
          ))}
        </div>
      </section>
    )
  else if (isArrival)
    content = (
      <section className="panel content-panel">
        <LegendaryEncounter
          species={foeSpecies}
          level={battle.foe.level}
          hp={battle.foe.hp}
          onFight={() => setGame({ ...game, battle: { ...battle, phase: null } })}
          onRetreat={retreat}
        />
      </section>
    )
  else
    content = (
      <section className="panel content-panel">
        <div className="section-title">
          <div>
            <h2>
              {!battle
                ? `${region.name} 탐험`
                : battle.bossId
                  ? '보스 전투'
                  : isLegendary
                    ? '전설급 전투'
                    : isWild
                      ? '야생 전투'
                      : gyms[battle.gymIndex].name}
            </h2>
            <p>
              {battle?.gymIndex != null
                ? `상대 ${battle.stage + 1} / ${gyms[battle.gymIndex].foes.length}`
                : battle?.bossId
                  ? '보스를 격파하면 도감에 기록됩니다.'
                  : '주사위를 굴려 동료와 함께 모험하세요.'}
            </p>
          </div>
          {!inBattle && (
            <button className="primary" disabled={!active.hp} onClick={explore}>
              야생 탐험 →
            </button>
          )}
        </div>
        <div className={`battlefield${isLegendary ? ' legendary-field' : ''}`}>
          <Monster monster={active} species={species} side="ally" />
          {battle && (
            <>
              <span className="battle-die" aria-label={battle.lastRoll ? '주사위 ' + battle.lastRoll : '대전'}>
                {battle.lastRoll || '⚄'}
              </span>
              <Monster monster={battle.foe} species={foeSpecies} side="enemy" />
            </>
          )}
        </div>
        {isLegendary && battle.ended && legendOutcomes[battle.result] && (
          <div className="legend-result">
            <span aria-hidden="true">✦</span>
            <div>
              <h3>{legendOutcomes[battle.result]}</h3>
              <p>
                {foeSpecies.name}
                {battle.result === 'captured' && ' · 도감에 기록되었습니다.'}
              </p>
            </div>
          </div>
        )}
        {battle && (
          <div className="battle-log" role="status">
            {battle.log.map((line, index) => (
              <div key={index}>{line}</div>
            ))}
          </div>
        )}
        {inBattle && (
          <div className="move-grid">
            {species.moves.map((move) => (
              <button key={move.id} disabled={!canUseMove(active, move)} onClick={() => takeTurn(move)}>
                <strong>{move.name}</strong>
                <Type type={move.type} />
                <span>
                  ⚄ {move.min}–{move.max} ·{' '}
                  {active.level < move.unlockLevel
                    ? `Lv. ${move.unlockLevel} 해금`
                    : `PP ${remainingPp(active, move)}/${move.maxPp}`}
                </span>
              </button>
            ))}
          </div>
        )}
        {inBattle && (
          <div className="action-row">
            {isWild && (
              <>
                <button disabled={!canCapture} onClick={() => capture(false)}>
                  포획 시도
                </button>
                <button disabled={!game.bag.capsule || !canCapture} onClick={() => capture(true)}>
                  캡슐 사용 ({game.bag.capsule})
                </button>
              </>
            )}
            <button onClick={retreat}>{isWild ? '후퇴' : '도전 포기'}</button>
          </div>
        )}
        {canCapture && (
          <p className="capture-odds">
            포획 확률 {Math.round(catchChance(battle.foe, foeSpecies, false) * 100)}% · 캡슐 사용 시{' '}
            {Math.round(catchChance(battle.foe, foeSpecies, true) * 100)}%
          </p>
        )}
        {inBattle && !species.moves.some((move) => canUseMove(active, move)) && (
          <p className="muted">상점에서 기력 열매를 사용하거나 전투에서 물러날 수 있습니다.</p>
        )}
        {!inBattle && (
          <div className="action-row">
            <button onClick={rest}>✦ 캠프에서 회복</button>
          </div>
        )}
      </section>
    )

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <button
            className="brand"
            onClick={() => {
              setTab('field')
              setNotice('')
            }}
          >
            <span className="brand-icon">⚄</span>
            <span>
              DICE<span>WILD</span>
              <small>주사위 RPG</small>
            </span>
          </button>
          <nav aria-label="게임 메뉴">
            {tabs.map(([id, icon, name]) => (
              <button
                key={id}
                className={tab === id ? 'current' : ''}
                aria-current={tab === id ? 'page' : undefined}
                disabled={!active && !['field', 'dex', 'classic'].includes(id)}
                onClick={() => {
                  setTab(id)
                  setNotice('')
                }}
              >
                <span>{icon}</span>
                {name}
              </button>
            ))}
          </nav>
          <div className="top-status">
            <span className="coins">◈ {game.coins}</span>
            <button className="reset" onClick={reset} title="새 게임" aria-label="새 게임">
              ↻
            </button>
          </div>
        </div>
      </header>
      <main>
        <section className="hero">
          <div className="hero-inner">
            <span className="region">
              <span /> {region.name} 지역
            </span>
            <h1>
              다이스 <em>와일드</em>
            </h1>
            <p>주사위를 굴리고, 야생의 동료를 만나세요.</p>
          </div>
          <span className="hero-coordinates">♧ &nbsp; {region.name} 캠프</span>
        </section>
        <div className="layout">
          {content}
          <aside className="sidebar">
            <section className="panel catalog-status">
              <h2>
                몬스터 API{' '}
                <span>
                  {catalogSize} / {monsterCount}종
                </span>
              </h2>
              <p role="status">
                {catalog.status === 'live'
                  ? 'API 상세 응답으로 불러옴'
                  : catalog.status === 'loading'
                    ? 'API 연결 확인 중…'
                    : catalog.status === 'failed'
                      ? catalogSize
                        ? 'API 연결 실패 · 저장된 도감 사용 중'
                        : 'API 연결 실패'
                      : catalog.status === 'partial'
                        ? `API 상세 ${catalog.received}종 수신 · 이용 가능 ${catalogSize}종`
                        : '저장된 도감 사용 중'}
              </p>
              {dex && catalog.status !== 'loading' && (
                <button className="weather-retry" onClick={retryCatalog}>
                  API 다시 확인
                </button>
              )}
            </section>
            <section className="panel summary">
              <div className="summary-title">
                <span className="item-icon">♙</span>
                <h2>내 탐험 기록</h2>
              </div>
              <div className="stat">
                <span>◇ &nbsp; 보유 코인</span>
                <strong className="coins">{game.coins}</strong>
              </div>
              <div className="stat">
                <span>♙ &nbsp; 동료 몬스터</span>
                <strong>
                  {game.team.length}
                  <small> 마리</small>
                </strong>
              </div>
              <div className="stat">
                <span>⚑ &nbsp; 체육관 배지</span>
                <strong>
                  {game.badges.length}
                  <small> / 3</small>
                </strong>
              </div>
              <div className="badges">
                {gyms.map((gym, i) => (
                  <span key={gym.name} className={i < game.badges.length ? 'earned' : ''} title={gym.badge}>
                    {marks[gym.type]}
                  </span>
                ))}
              </div>
            </section>
            <WeatherPanel
              region={region}
              weather={regionWeather}
              badges={game.badges.length}
              onRegion={(id) => setGame((previous) => ({ ...previous, region: id }))}
              onRetry={() => {
                setWeather(null)
                setWeatherAttempt((attempt) => attempt + 1)
              }}
            />
            <section className="panel tip">
              <span className="tip-icon">✦</span>
              <div>
                <h3>탐험 팁</h3>
                <p>
                  {active
                    ? '야생 몬스터의 HP를 45% 이하로 낮추면 포획할 수 있어요.'
                    : '기술의 타입이 상대에게 유리하면 주사위 피해가 2배가 돼요.'}
                </p>
              </div>
            </section>
          </aside>
        </div>
        {notice && (
          <div className="notice" role="status">
            {notice}
          </div>
        )}
        <details className="source-credit">
          <summary>몬스터 출처 · D&D 5e SRD API · CC BY 4.0</summary>
          <p>
            API의 이름, 분류, 도전 등급, HP와 피해 주사위를 사용했습니다. 일부 이름을 번역하고 HP, 주사위 범위와
            타입을 게임용으로 조정했습니다. 몬스터 그림은 새로 제작했습니다.
          </p>
          <p>
            <a href="https://docs.dnd5eapi.co/">D&D 5e SRD API</a>
          </p>
          <p>
            This work includes material taken from the System Reference Document 5.1 (“SRD 5.1”) by Wizards of the
            Coast LLC and available at{' '}
            <a href="https://dnd.wizards.com/resources/systems-reference-document">
              https://dnd.wizards.com/resources/systems-reference-document
            </a>
            . The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at{' '}
            <a href="https://creativecommons.org/licenses/by/4.0/legalcode">
              https://creativecommons.org/licenses/by/4.0/legalcode
            </a>
            .
          </p>
        </details>
        <footer>
          <span>⚄ &nbsp; DICE WILD</span>
          <span>
            <i /> {saveError ? '진행 상황을 저장할 수 없습니다' : '진행 상황 자동 저장'}
          </span>
        </footer>
      </main>
    </div>
  )
}

export default App
