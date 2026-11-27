const dotPatterns = [[], [4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]]

export default function Die({ value, clicked, clickfn }) {
  return (
    <button className="classic-die" onClick={clickfn} aria-label={`주사위 ${value}`} aria-pressed={clicked}>
      {Array.from({ length: 9 }, (_, index) => (
        <span key={index} className={dotPatterns[value].includes(index) ? 'dot' : ''} aria-hidden="true" />
      ))}
    </button>
  )
}
