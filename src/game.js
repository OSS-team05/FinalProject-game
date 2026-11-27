export const starters = ['goblin', 'magma-mephit', 'ice-mephit']

export const types = {
  normal: '일반',
  leaf: '풀',
  fire: '불꽃',
  water: '물',
  stone: '바위',
  ground: '땅',
  ice: '얼음',
  lightning: '전기',
  undead: '언데드',
  dark: '어둠',
  wind: '바람',
  poison: '독',
  light: '빛',
}
export const marks = {
  normal: '✦',
  leaf: '✿',
  fire: '♨',
  water: '◈',
  stone: '◆',
  ground: '⬟',
  ice: '❄',
  lightning: 'ϟ',
  undead: '☠',
  dark: '☾',
  wind: '≋',
  poison: '♠',
  light: '☀',
}
export const rarities = { common: '일반', rare: '희귀', heroic: '영웅', legendary: '전설급', boss: '보스' }
export const gyms = [
  { name: '바위 동굴', type: 'stone', level: 2, foes: ['kobold', 'mimic'], badge: '암석 배지' },
  { name: '물안개 호수', type: 'water', level: 5, foes: ['merrow', 'water-elemental'], badge: '물결 배지' },
  { name: '잿불 산맥', type: 'fire', level: 8, foes: ['fire-elemental', 'young-red-dragon'], badge: '잿불 배지' },
]
export const bosses = [
  { id: 'ancient-black-dragon', level: 12 },
  { id: 'lich', level: 13 },
  { id: 'kraken', level: 14 },
  { id: 'ancient-gold-dragon', level: 15 },
  { id: 'ancient-red-dragon', level: 16 },
  { id: 'tarrasque', level: 18, final: true },
]

export const items = {
  heal: { name: '회복약', icon: '♥', price: 18, description: 'HP를 20 회복합니다.' },
  pp: { name: '기력 열매', icon: '✦', price: 16, description: '모든 기술의 PP를 5 회복합니다.' },
  power: { name: '파워 씨앗', icon: '↟', price: 22, description: '다음 공격의 주사위에 +3을 더합니다.' },
  capsule: { name: '포획 캡슐', icon: '◎', price: 14, description: '야생 몬스터 포획 확률을 높입니다.' },
}
const chart = {
  leaf: { water: 2, ground: 2, stone: 2, fire: 0.5, leaf: 0.5, poison: 0.5 },
  fire: { leaf: 2, ice: 2, water: 0.5, stone: 0.5, fire: 0.5 },
  water: { fire: 2, stone: 2, ground: 2, leaf: 0.5, water: 0.5 },
  stone: { fire: 2, wind: 2, stone: 0.5 },
  ground: { fire: 2, stone: 2, lightning: 2, wind: 0, leaf: 0.5 },
  ice: { leaf: 2, ground: 2, wind: 2, fire: 0.5, water: 0.5, ice: 0.5 },
  lightning: { water: 2, wind: 2, ground: 0, lightning: 0.5, leaf: 0.5 },
  undead: { light: 0.5, dark: 0.5 },
  dark: { light: 2, undead: 0.5, dark: 0.5 },
  light: { undead: 2, dark: 2, light: 0.5 },
  wind: { leaf: 2, poison: 2, stone: 0.5 },
  poison: { leaf: 2, undead: 0, stone: 0.5, poison: 0.5 },
  normal: { stone: 0 },
}
const rarityWeights = { common: 88, rare: 9, heroic: 2, legendary: 1 }
const difficulty = { common: 0, rare: 1, heroic: 2, legendary: 3 }
const captureRates = {
  common: { multiplier: 1, limit: 0.95 },
  rare: { multiplier: 0.75, limit: 0.68 },
  heroic: { multiplier: 0.5, limit: 0.45 },
  legendary: { multiplier: 0.3, limit: 0.26 },
}

export const roll = (min, max) => min + Math.floor(Math.random() * (max - min + 1))
export const captureThreshold = 0.45
export const maxHp = (species, level) => species.hp + (level - 1) * 4
export const neededXp = (level) => level * 12
export const encounterLevel = (species, badges) => roll(1, 2) + badges * 2 + difficulty[species.rarity]

export function pickWild(dex, region, badges, weatherType) {
  const unlocked = Object.values(dex).filter(
    (species) => species.rarity !== 'boss' && species.unlockBadges <= badges && species.habitats.includes(region),
  )
  const rarityTickets = Object.entries(rarityWeights).flatMap(([rarity, weight]) =>
    unlocked.some((monster) => monster.rarity === rarity) ? Array(weight).fill(rarity) : [],
  )
  if (!rarityTickets.length) return null
  const rarity = rarityTickets[roll(0, rarityTickets.length - 1)]
  // Weather doubles a matching monster's weight after the rarity has been drawn.
  const speciesTickets = unlocked
    .filter((species) => species.rarity === rarity)
    .flatMap((species) => (species.types.includes(weatherType) ? [species, species] : [species]))
  return speciesTickets[roll(0, speciesTickets.length - 1)]
}

export function fullPp(species) {
  return Object.fromEntries(species.moves.map((move) => [move.id, move.maxPp]))
}

export function remainingPp(monster, move) {
  return Math.min(monster.pp?.[move.id] ?? move.maxPp, move.maxPp)
}

export function canUseMove(monster, move) {
  return monster.level >= move.unlockLevel && remainingPp(monster, move) > 0
}

export function makeMonster(species, level = 1, uid = crypto.randomUUID()) {
  return { uid, species: species.id, level, xp: 0, hp: maxHp(species, level), pp: fullPp(species) }
}

export function attack(move, defenderTypes, boost = 0) {
  const value = roll(move.min, move.max)
  const multiplier = defenderTypes.reduce((total, type) => total * (chart[move.type]?.[type] ?? 1), 1)
  return { value, multiplier, boost, damage: Math.round((value + boost) * multiplier) }
}

export function reward(monster, amount, species) {
  let { level, xp } = monster
  xp += amount
  while (xp >= neededXp(level)) {
    xp -= neededXp(level)
    level++
  }
  return { ...monster, level, xp, hp: Math.min(maxHp(species, level), monster.hp + (level - monster.level) * 4) }
}

export function catchChance(foe, species, boosted) {
  const rates = captureRates[species.rarity]
  if (!rates) return 0
  const hpRatio = foe.hp / maxHp(species, foe.level)
  const base = 0.79 - hpRatio * 0.62 - (foe.level - 1) * 0.012 - species.cr * 0.004
  return Math.min(rates.limit, Math.max(0.03, (base + (boosted ? 0.23 : 0)) * rates.multiplier))
}
