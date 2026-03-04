import { useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { createNoise3D } from 'simplex-noise'

const COUNT = 2000
const BASE_RADIUS = 4.0
const RIBBON_COUNT = 40   // must match RibbonBall.jsx

function makeRng(seed) {
  let s = (seed + 0x6D2B79F5) | 0
  return () => {
    s = (s + 0x6D2B79F5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const _col = new THREE.Color()

export default function DustBall() {
  const groupRef = useRef()
  const pointsRef = useRef()
  const matRef = useRef()
  const { scene } = useThree()

  const noise3D = useMemo(() => {
    const rng = makeRng(99991)
    return createNoise3D(rng)
  }, [])

  // Per-ribbon cluster centroid accumulators — reused every frame, no GC
  const clusterSums = useRef(new Float32Array(RIBBON_COUNT * 3))

  useMemo(() => {
    // Per-ribbon cluster centroids (world space): ribbons read this to find
    // where their paired dust particles actually are right now
    scene.userData.ribbonClusters = new Float32Array(RIBBON_COUNT * 3)
  }, [scene])

  const { positions, colors, phases, basePositions, baseRadii, hueBase } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3)
    const colors = new Float32Array(COUNT * 3)
    const phases = new Float32Array(COUNT)
    const basePositions = new Float32Array(COUNT * 3)
    const baseRadii = new Float32Array(COUNT)
    const hueBase = new Float32Array(COUNT)
    const rng = makeRng(12345)

    for (let i = 0; i < COUNT; i++) {
      const theta = rng() * Math.PI * 2
      const phi = Math.acos(2 * rng() - 1)
      const r = Math.cbrt(rng()) * BASE_RADIUS

      const x = r * Math.sin(phi) * Math.cos(theta)
      const y = r * Math.sin(phi) * Math.sin(theta)
      const z = r * Math.cos(phi)

      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z
      basePositions[i * 3] = x
      basePositions[i * 3 + 1] = y
      basePositions[i * 3 + 2] = z
      baseRadii[i] = r
      hueBase[i] = (Math.atan2(z, x) / (Math.PI * 2) + 0.5)

      colors[i * 3] = 0.03
      colors[i * 3 + 1] = 0.03
      colors[i * 3 + 2] = 0.07

      phases[i] = rng() * Math.PI * 2
    }

    return { positions, colors, phases, basePositions, baseRadii, hueBase }
  }, [])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const { agitation = 1.0, dustPos = [-7, 0, 0] } = scene.userData
    const calm = 1.0 - agitation

    if (groupRef.current) {
      groupRef.current.position.set(dustPos[0], dustPos[1], dustPos[2])
      groupRef.current.rotation.y = t * 0.05
      const ballScale = scene.userData.ballScale ?? 1.0
      groupRef.current.scale.setScalar(ballScale)
    }

    const mergeProgress = Math.max(0, 1.0 - Math.abs(dustPos[0]) / 5.0)

    if (matRef.current) {
      matRef.current.opacity = 0.92 - mergeProgress * 0.32
    }

    const expandFactor = 1.0 + agitation * 0.1
    const sparkleSpeed = 3.0 + agitation * 3.0
    const noiseScale = 0.0
    const driftAmt = 0.2 + agitation * 0.4 + calm * 0.1

    const rh = scene.userData.ribbonHeads  // written by RibbonBall previous frame
    const cs = clusterSums.current

    // Zero cluster accumulators
    cs.fill(0)

    for (let i = 0; i < COUNT; i++) {
      const bx = basePositions[i * 3]
      const by = basePositions[i * 3 + 1]
      const bz = basePositions[i * 3 + 2]
      const phi = phases[i]
      const baseR = baseRadii[i]

      const nx = noise3D(bx * noiseScale + t * 0.1, by * noiseScale, phi)
      const ny = noise3D(bx * noiseScale, by * noiseScale + t * 0.1, phi + 10)
      const nz = noise3D(bx * noiseScale, by * noiseScale, bz * noiseScale + t * 0.1 + phi)

      positions[i * 3] = bx * expandFactor + nx * driftAmt
      positions[i * 3 + 1] = by * expandFactor + ny * driftAmt
      positions[i * 3 + 2] = bz * expandFactor + nz * driftAmt

      // Surface ripples (calm mode)
      if (calm > 0.5) {
        const surfaceness = baseR / BASE_RADIUS
        const invR = baseR > 0.01 ? 1.0 / baseR : 0.0
        const ring = Math.sin(baseR * 2.8 - t * 0.7 + phi)
        const latProxy = by * invR
        const band = Math.sin(latProxy * 5.0 + t * 0.5 + phi * 0.5)
        const ripple = (ring * 0.6 + band * 0.4) * calm * 0.32 * surfaceness
        positions[i * 3]     += bx * invR * ripple
        positions[i * 3 + 1] += by * invR * ripple
        positions[i * 3 + 2] += bz * invR * ripple
      }

      // ── Ribbon attraction (post-merge) ──────────────────────────────────────
      // Each particle is paired to a ribbon. A strong pull displaces the particle
      // toward that ribbon head, creating visible clustering around moving ribbons.
      if (rh && mergeProgress > 0.2) {
        const ri = (i % RIBBON_COUNT) * 3
        // Convert ribbon world pos to dust-local space
        const rhLx = rh[ri]     - dustPos[0]
        const rhLy = rh[ri + 1] - dustPos[1]
        const rhLz = rh[ri + 2] - dustPos[2]

        const dx = rhLx - positions[i * 3]
        const dy = rhLy - positions[i * 3 + 1]
        const dz = rhLz - positions[i * 3 + 2]
        const distSq = dx * dx + dy * dy + dz * dz

        // Strong pull so it's clearly visible; falls off with distance
        const pull = mergeProgress * 0.8 / (1.0 + distSq * 0.12)
        positions[i * 3]     += dx * pull
        positions[i * 3 + 1] += dy * pull
        positions[i * 3 + 2] += dz * pull
      }

      // Accumulate cluster centroid for this particle's paired ribbon (world space)
      const ri = (i % RIBBON_COUNT) * 3
      cs[ri]     += positions[i * 3]     + dustPos[0]
      cs[ri + 1] += positions[i * 3 + 1] + dustPos[1]
      cs[ri + 2] += positions[i * 3 + 2] + dustPos[2]

      // Color
      const hue = 0.58 + ((hueBase[i] + t * 0.04) % 1.0) * 0.42
      _col.setHSL(hue, 1.0, 0.28)

      const sparkle = Math.pow(Math.max(0, Math.sin(t * sparkleSpeed + phi)), 8)
      const baseBrightness = 0.65 + sparkle * 0.35
      const glowMultiplier = 1.0 + mergeProgress * 1.8
      const brightness = baseBrightness * glowMultiplier

      colors[i * 3]     = _col.r * brightness
      colors[i * 3 + 1] = _col.g * brightness
      colors[i * 3 + 2] = _col.b * brightness
    }

    // ── Finalize per-ribbon cluster centroids ─────────────────────────────────
    const particlesPerRibbon = COUNT / RIBBON_COUNT   // 125
    const rc = scene.userData.ribbonClusters
    for (let j = 0; j < RIBBON_COUNT; j++) {
      const j3 = j * 3
      rc[j3]     = cs[j3]     / particlesPerRibbon
      rc[j3 + 1] = cs[j3 + 1] / particlesPerRibbon
      rc[j3 + 2] = cs[j3 + 2] / particlesPerRibbon
    }

    if (pointsRef.current) {
      pointsRef.current.geometry.attributes.position.needsUpdate = true
      pointsRef.current.geometry.attributes.color.needsUpdate = true
    }
  })

  return (
    <group ref={groupRef}>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" array={positions} count={COUNT} itemSize={3} />
          <bufferAttribute attach="attributes-color" array={colors} count={COUNT} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial
          ref={matRef}
          vertexColors
          size={0.04}
          sizeAttenuation
          toneMapped={false}
          transparent
          opacity={0.92}
        />
      </points>
    </group>
  )
}
