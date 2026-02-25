import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const COUNT = 800

export default function Background() {
  const pointsRef = useRef()

  const { positions, colors, phases } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3)
    const colors = new Float32Array(COUNT * 3)
    const phases = new Float32Array(COUNT)

    // Use seeded values for determinism
    let s = 42
    const rng = () => {
      s = (s + 0x6D2B79F5) | 0
      let t = Math.imul(s ^ (s >>> 15), 1 | s)
      t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }

    for (let i = 0; i < COUNT; i++) {
      const theta = rng() * Math.PI * 2
      const phi = Math.acos(2 * rng() - 1)
      const r = 22 + rng() * 6

      const x = r * Math.sin(phi) * Math.cos(theta)
      const y = r * Math.sin(phi) * Math.sin(theta)
      const z = r * Math.cos(phi)

      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z

      colors[i * 3] = 0.01
      colors[i * 3 + 1] = 0.01
      colors[i * 3 + 2] = 0.015

      phases[i] = rng() * Math.PI * 2
    }

    return { positions, colors, phases }
  }, [])

  useFrame((state) => {
    const t = state.clock.elapsedTime

    for (let i = 0; i < COUNT; i++) {
      const phi = phases[i]
      const s = Math.sin(t * 0.5 + phi)
      const flicker = 0.005 + 0.012 * Math.pow(Math.max(0, s), 4)
      colors[i * 3] = flicker * 0.7
      colors[i * 3 + 1] = flicker * 0.7
      colors[i * 3 + 2] = flicker
    }

    if (pointsRef.current) {
      pointsRef.current.geometry.attributes.color.needsUpdate = true
    }
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={COUNT}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          array={colors}
          count={COUNT}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial vertexColors size={0.06} sizeAttenuation toneMapped={false} />
    </points>
  )
}
