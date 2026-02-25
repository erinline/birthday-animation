import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { createNoise3D } from 'simplex-noise'

const TRAIL_LENGTH = 80
const NOISE_SCALE = 0.35
const SPEED = 0.4
const MOUSE_RADIUS = 3.5
const MOUSE_STRENGTH = 0.08

function makeAleaPrng(seed) {
  // Simple seeded PRNG using the seed string
  let s = seed * 2654435761 >>> 0
  return () => {
    s ^= s << 13
    s ^= s >> 17
    s ^= s << 5
    return (s >>> 0) / 4294967296
  }
}

export default function Ribbon({ seed, color, startPosition }) {
  const lineRef = useRef()
  const timeRef = useRef(0)

  // Seeded noise function
  const noise3D = useMemo(() => {
    // We create a seeded RNG to pass to createNoise3D
    const prng = makeAleaPrng(seed * 1000 + 1)
    return createNoise3D(prng)
  }, [seed])

  // Pre-allocate buffers
  const { positions, colors, points } = useMemo(() => {
    const maxVerts = TRAIL_LENGTH
    const positions = new Float32Array(maxVerts * 3)
    const colors = new Float32Array(maxVerts * 3)

    // Initialize ring buffer with start position
    const points = []
    for (let i = 0; i < maxVerts; i++) {
      points.push(new THREE.Vector3(
        startPosition[0],
        startPosition[1],
        startPosition[2]
      ))
    }

    return { positions, colors, points }
  }, [startPosition])

  // Noise offsets based on seed to differentiate ribbons
  const noiseOffset = seed * 137.508

  useFrame((state, delta) => {
    timeRef.current += delta * SPEED

    const t = timeRef.current
    const mouse = state.scene.userData.mouseWorld

    // Get current head
    const head = points[0].clone()

    // Sample noise flow field at head position
    const nx = head.x * NOISE_SCALE + noiseOffset
    const ny = head.y * NOISE_SCALE + noiseOffset
    const nz = head.z * NOISE_SCALE + t

    const angle = noise3D(nx, ny, nz) * Math.PI * 2
    const angle2 = noise3D(nx + 100, ny + 100, nz) * Math.PI

    // Step head forward in flow field direction
    const stepSize = 0.035
    head.x += Math.cos(angle) * Math.sin(angle2) * stepSize
    head.y += Math.sin(angle) * Math.sin(angle2) * stepSize
    head.z += Math.cos(angle2) * stepSize * 0.5

    // Mouse warp — push head away from mouse world position
    if (mouse) {
      const dx = head.x - mouse.x
      const dy = head.y - mouse.y
      const dz = head.z - mouse.z
      const distSq = dx * dx + dy * dy + dz * dz
      const dist = Math.sqrt(distSq)

      if (dist < MOUSE_RADIUS && dist > 0.001) {
        const force = MOUSE_STRENGTH * (1 - dist / MOUSE_RADIUS) / dist
        head.x += dx * force
        head.y += dy * force
        head.z += dz * force
      }
    }

    // Soft boundary: gently push back toward center if too far
    const maxRange = 12
    const headDist = Math.sqrt(head.x * head.x + head.y * head.y + head.z * head.z)
    if (headDist > maxRange) {
      const pull = 0.02
      head.x -= (head.x / headDist) * pull
      head.y -= (head.y / headDist) * pull
      head.z -= (head.z / headDist) * pull
    }

    // Shift ring buffer: drop last, prepend new head
    for (let i = TRAIL_LENGTH - 1; i > 0; i--) {
      points[i].copy(points[i - 1])
    }
    points[0].copy(head)

    // Write positions and vertex colors into buffers
    const col = new THREE.Color(color)
    for (let i = 0; i < TRAIL_LENGTH; i++) {
      const p = points[i]
      positions[i * 3 + 0] = p.x
      positions[i * 3 + 1] = p.y
      positions[i * 3 + 2] = p.z

      // Fade from bright (head) to dim (tail)
      const t = i / (TRAIL_LENGTH - 1)
      const brightness = Math.pow(1 - t, 1.5) * 2.0  // >1 to activate bloom
      colors[i * 3 + 0] = col.r * brightness
      colors[i * 3 + 1] = col.g * brightness
      colors[i * 3 + 2] = col.b * brightness
    }

    if (lineRef.current) {
      const geo = lineRef.current.geometry
      geo.attributes.position.needsUpdate = true
      geo.attributes.color.needsUpdate = true
      geo.setDrawRange(0, TRAIL_LENGTH)
    }
  })

  return (
    <line ref={lineRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={TRAIL_LENGTH}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          array={colors}
          count={TRAIL_LENGTH}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial vertexColors toneMapped={false} />
    </line>
  )
}
