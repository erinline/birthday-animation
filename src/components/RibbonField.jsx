import { useMemo } from 'react'
import Ribbon from './Ribbon'

const COUNT = 40
const GOLDEN_RATIO = 1.6180339887

// Simple seeded random using mulberry32
function seededRandom(seed) {
  let s = seed
  return () => {
    s |= 0
    s = s + 0x6D2B79F5 | 0
    let t = Math.imul(s ^ s >>> 15, 1 | s)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

export default function RibbonField() {
  const ribbons = useMemo(() => {
    const result = []
    // Hue range: 180–300 (blue → purple → violet → magenta)
    const hueMin = 180
    const hueRange = 120

    for (let i = 0; i < COUNT; i++) {
      const seed = i * GOLDEN_RATIO
      const rng = seededRandom(i * 12345 + 999)

      // Random start position in a sphere of radius 6
      const theta = rng() * Math.PI * 2
      const phi = Math.acos(2 * rng() - 1)
      const r = Math.cbrt(rng()) * 6  // cube root for uniform sphere distribution

      const startPosition = [
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi),
      ]

      // HSL color in the blue/purple/violet range
      const hue = hueMin + rng() * hueRange
      const sat = 70 + rng() * 30
      const light = 55 + rng() * 30
      const color = `hsl(${hue}, ${sat}%, ${light}%)`

      result.push({ seed, color, startPosition })
    }
    return result
  }, [])

  return (
    <group>
      {ribbons.map((props, i) => (
        <Ribbon key={i} {...props} />
      ))}
    </group>
  )
}
