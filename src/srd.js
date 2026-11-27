import { roster } from './srdRoster.js'

export const monstersUrl = 'https://www.dnd5eapi.co/api/2014/monsters'
export const monsterCount = Object.keys(roster).length
const cacheKey = 'dice-wild-srd-catalog-v1'
const cacheLifetime = 24 * 60 * 60 * 1000
const batchSize = 6

const balance = {
  common: { hp: [18, 35, 45], cap: 12, badges: 0 },
  rare: { hp: [35, 51, 140], cap: 15, badges: 1 },
  heroic: { hp: [49, 68, 185], cap: 19, badges: 2 },
  legendary: { hp: [70, 89, 350], cap: 22, badges: 3 },
  boss: { hp: [88, 120, 680], cap: 26, badges: 3 },
}

const damageElements = {
  acid: 'poison',
  cold: 'ice',
  fire: 'fire',
  lightning: 'lightning',
  necrotic: 'dark',
  poison: 'poison',
  psychic: 'dark',
  radiant: 'light',
  thunder: 'wind',
}
const kindTypes = { undead: 'undead', plant: 'leaf', construct: 'stone', fiend: 'dark', celestial: 'light' }
const unlockLevels = [1, 3, 5, 8]

export function parseDice(expression) {
  const formula = String(expression ?? '')
    .replace(/\s/g, '')
    .toLowerCase()
  if (!/^-?(?:\d*d\d+|\d+)(?:[+-](?:\d*d\d+|\d+))*$/.test(formula)) return null
  let min = 0
  let max = 0
  for (const term of formula.match(/[+-]?(?:\d*d\d+|\d+)/g)) {
    const sign = term.startsWith('-') ? -1 : 1
    const value = term.replace(/^[+-]/, '')
    const [count, sides] = value.split('d')
    const low = Number(count || 1)
    if (sides && (low < 1 || Number(sides) < 1)) return null
    const high = sides ? low * Number(sides) : low
    min += sign === 1 ? low : -high
    max += sign === 1 ? high : -low
  }
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max)) return null
  return { min: Math.max(0, min), max: Math.max(0, max) }
}

export function rarityFor(cr) {
  if (cr <= 1) return 'common'
  if (cr <= 5) return 'rare'
  if (cr <= 10) return 'heroic'
  return cr < 20 ? 'legendary' : 'boss'
}

function readDamage(entry) {
  if (!entry) return null
  const choice = entry.from?.options?.find((option) => option.damage_dice)
  const part = entry.damage_dice ? entry : choice
  const range = parseDice(part?.damage_dice)
  if (!range?.max) return null
  return {
    ...range,
    dice: part.damage_dice,
    kind: part.damage_type?.index ?? 'unknown',
    name: part.damage_type?.name ?? '—',
  }
}

function getMoves(monster, cap) {
  const actions = [...(monster.actions ?? []), ...(monster.legendary_actions ?? [])].flatMap((action) => [
    action,
    ...(action.options?.from?.options ?? []),
  ])
  const candidates = new Map()
  for (const action of actions) {
    if (typeof action.name !== 'string' || !action.name.trim() || !Array.isArray(action.damage)) continue
    const damage = action.damage.map(readDamage).filter(Boolean)
    if (!damage.length) continue
    const id = action.name.trim().toLowerCase()
    if (candidates.has(id)) continue
    candidates.set(id, {
      id,
      name: action.name,
      damage,
      type: damage.map((part) => damageElements[part.kind]).find(Boolean) ?? 'normal',
      rawMin: damage.reduce((sum, part) => sum + part.min, 0),
      rawMax: damage.reduce((sum, part) => sum + part.max, 0),
    })
  }
  const ordered = [...candidates.values()].sort((a, b) => a.rawMax - b.rawMax || a.id.localeCompare(b.id))
  const selection = ordered.length > 4 ? [ordered[0], ...ordered.slice(-3)] : ordered
  const ranges = new Set()
  return selection.map((move, index) => {
    const scale = Math.min(1, cap / move.rawMax)
    const max = Math.max(1, Math.round(move.rawMax * scale))
    let min = Math.max(1, Math.round(move.rawMin * scale))
    while (min < max && ranges.has(`${min}-${max}`)) min++
    ranges.add(`${min}-${max}`)
    const maxPp = Math.max(3, 15 - Math.floor((min + max) / 2) - index * 2)
    return { ...move, min, max, maxPp, unlockLevel: unlockLevels[index] }
  })
}

export function normalizeMonster(id, raw) {
  const selection = roster[id]
  if (
    !selection ||
    raw?.index !== id ||
    typeof raw.name !== 'string' ||
    typeof raw.type !== 'string' ||
    !Number.isFinite(raw.hit_points) ||
    raw.hit_points < 1 ||
    !Number.isFinite(raw.challenge_rating) ||
    raw.challenge_rating < 0
  )
    return null

  const rarity = rarityFor(raw.challenge_rating)
  const {
    hp: [low, high, reference],
    cap,
    badges,
  } = balance[rarity]
  const rawMoves = getMoves(raw, cap)
  if (!rawMoves.length) return null

  const primary =
    selection.type ?? kindTypes[raw.type] ?? rawMoves.find((move) => move.type !== 'normal')?.type ?? 'normal'
  const secondary = kindTypes[raw.type]
  const types = secondary && secondary !== primary ? [primary, secondary] : [primary]
  const moves = rawMoves.map((move) =>
    move.type === 'normal' && ['elemental', 'plant'].includes(raw.type) ? { ...move, type: primary } : move,
  )

  return {
    id,
    name: selection.translation || raw.name,
    originalName: raw.name,
    kind: raw.type,
    rawHp: raw.hit_points,
    cr: raw.challenge_rating,
    hp: low + Math.round((high - low) * Math.sqrt(Math.min(1, raw.hit_points / reference))),
    rarity,
    unlockBadges: badges,
    types,
    habitats: selection.habitats,
    moves,
    apiImage: typeof raw.image === 'string' ? raw.image : null,
    art: `art/srd/${id}.png`,
  }
}

export function readCatalogCache() {
  try {
    const saved = JSON.parse(localStorage.getItem(cacheKey))
    if (!saved || !Number.isFinite(saved.savedAt)) return null
    const dex = Object.fromEntries(
      Object.entries(saved.dex ?? {}).filter(
        ([id, monster]) =>
          Object.hasOwn(roster, id) &&
          id === monster?.id &&
          typeof monster.name === 'string' &&
          typeof monster.originalName === 'string' &&
          Number.isFinite(monster.hp) &&
          Object.hasOwn(balance, monster.rarity) &&
          Array.isArray(monster.types) &&
          Array.isArray(monster.habitats) &&
          Array.isArray(monster.moves) &&
          monster.moves.length > 0,
      ),
    )
    return Object.keys(dex).length ? { dex, savedAt: saved.savedAt } : null
  } catch {
    return null
  }
}

export function catalogIsFresh(cache) {
  return !!cache && Object.keys(cache.dex).length === monsterCount && Date.now() - cache.savedAt < cacheLifetime
}

async function getJson(url, signal) {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`D&D API HTTP ${response.status}`)
  return response.json()
}

export async function fetchCatalog(cache, signal) {
  const list = await getJson(monstersUrl, signal)
  if (!Array.isArray(list.results)) throw new Error('D&D API 목록 형식을 확인할 수 없습니다.')
  const ids = new Set(list.results.map((entry) => entry?.index))
  const dex = { ...cache?.dex }
  const refreshAll = Object.keys(dex).length === monsterCount
  const targets = Object.keys(roster).filter((id) => ids.has(id) && (refreshAll || !dex[id]))
  let received = 0
  for (let offset = 0; offset < targets.length && !signal.aborted; offset += batchSize) {
    const details = await Promise.allSettled(
      targets.slice(offset, offset + batchSize).map(async (id) => {
        const raw = await getJson(`${monstersUrl}/${id}`, signal)
        const monster = normalizeMonster(id, raw)
        if (monster) return monster
        throw new Error(`몬스터 데이터 형식 오류 · ${id}`)
      }),
    )
    for (const result of details) {
      if (result.status !== 'fulfilled') continue
      const monster = result.value
      dex[monster.id] = monster
      received++
    }
  }
  const count = Object.keys(dex).length
  if (!received && !count) throw new Error('D&D API 상세 데이터를 불러오지 못했습니다.')
  const live = received === monsterCount
  const complete = count === monsterCount && targets.length === received && (refreshAll ? live : true)
  const savedAt = complete ? Date.now() : (cache?.savedAt ?? 0)
  if (received) {
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ savedAt, dex }))
    } catch {
      // The catalog can still be used for this session if storage is full or disabled.
    }
  }
  return { dex, savedAt, received, live }
}
