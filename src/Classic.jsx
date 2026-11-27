import { useEffect, useState } from 'react'
import Die from './Die'
import { roll } from './game'

const newDice = () => Array.from({ length: 10 }, () => ({ value: roll(1, 6), held: false }))

export default function Classic() {
  const [dice, setDice] = useState(newDice)
  const [started, setStarted] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [best, setBest] = useState(0)
  const won = dice.every((die) => die.held && die.value === dice[0].value)

  useEffect(() => {
    if (!started || won) return
    const timer = setInterval(() => setElapsed(Date.now() - started), 50)
    return () => clearInterval(timer)
  }, [started, won])

  function hold(index) {
    if (won) return
    const now = Date.now()
    if (!started) setStarted(now)
    const next = dice.map((die, i) => (i === index ? { ...die, held: !die.held } : die))
    setDice(next)
    if (next.every((die) => die.held && die.value === next[0].value)) {
      const time = Math.max(1, now - (started || now))
      setElapsed(time)
      setBest(best ? Math.min(best, time) : time)
    }
  }

  function reroll() {
    if (won) {
      setDice(newDice())
      setStarted(0)
      setElapsed(0)
      return
    }
    if (!started) setStarted(Date.now())
    setDice(dice.map((die) => (die.held ? die : { ...die, value: roll(1, 6) })))
  }

  return (
    <section className="panel classic">
      <h2>클래식 Tenzies</h2>
      <p>같은 눈을 고정하고 나머지를 굴려, 주사위 10개를 같은 눈으로 맞추세요.</p>
      <div className="classic-dice">
        {dice.map((die, index) => (
          <Die key={index} value={die.value} clicked={die.held} clickfn={() => hold(index)} />
        ))}
      </div>
      <button className="primary" onClick={reroll}>
        {won ? '다시 시작' : '주사위 굴리기'}
      </button>
      <p>
        현재 {(elapsed / 1000).toFixed(2)}초 · 최고 {best ? (best / 1000).toFixed(2) + '초' : '—'}
      </p>
      {won && <p role="status">성공! 모든 주사위가 같은 눈입니다.</p>}
    </section>
  )
}
