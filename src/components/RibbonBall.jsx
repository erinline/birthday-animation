import { useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const RIBBON_COUNT = 40
const TRAIL_LENGTH = 80
const SPHERE_RADIUS = 3.0
const SOFT_RADIUS = 2.5   // calm mode: gentle return begins here

function makeRng(seed) {
  let s = (seed * 12345 + 999) | 0
  s = (s + 0x6D2B79F5) | 0
  return () => {
    s = (s + 0x6D2B79F5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Pre-allocated scratch
const _normal = new THREE.Vector3()
const _col = new THREE.Color()

function SingleRibbon({ ribbonIndex, startPos, startVel, orbitAxis }) {
  const { scene } = useThree()
  const lineRef = useRef()
  const headRef = useRef(startPos.clone())
  const velRef = useRef(startVel.clone())

  const { positions, colors, points } = useMemo(() => {
    const positions = new Float32Array(TRAIL_LENGTH * 3)
    const colors = new Float32Array(TRAIL_LENGTH * 3)
    const points = []
    const { x, y, z } = startPos
    for (let i = 0; i < TRAIL_LENGTH; i++) {
      points.push(new THREE.Vector3(x, y, z))
      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z
    }
    return { positions, colors, points }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const agitation = scene.userData.agitation ?? 1.0
    const calm = 1.0 - agitation

    // Agitated = fast straight lines; calm = slow arcs
    const speed = 0.03 + agitation * 0.09

    // Move head along current velocity
    headRef.current.addScaledVector(velRef.current, speed)

    const dist = headRef.current.length()

    // ── Calm mode: soft inward spring past SOFT_RADIUS ──────────────────────
    // Prevents ribbons from reaching the hard wall; the spring grows with excess.
    if (calm > 0.01 && dist > SOFT_RADIUS) {
      _normal.copy(headRef.current).normalize()
      const excess = dist - SOFT_RADIUS
      velRef.current.addScaledVector(_normal, -excess * 0.018 * calm)
      velRef.current.normalize()
    }

    // ── Agitated mode: hard sphere reflection ────────────────────────────────
    // Only fires when ribbons actually reach the wall (calm spring prevents this
    // when agitation is low, so it naturally fades out during the transition).
    if (dist >= SPHERE_RADIUS) {
      _normal.copy(headRef.current).normalize()
      const dot = velRef.current.dot(_normal)
      velRef.current.addScaledVector(_normal, -2 * dot)
      velRef.current.normalize()
      headRef.current.copy(_normal).multiplyScalar(SPHERE_RADIUS - 0.01)
    }

    // ── Calm mode: curve velocity around ribbon's unique axis → looping arcs ─
    // At full calm, each ribbon traces a gentle circular arc in 3D space.
    if (calm > 0.01) {
      velRef.current.applyAxisAngle(orbitAxis, 0.015 * calm)
      velRef.current.normalize()
    }

    // Shift ring buffer
    for (let i = TRAIL_LENGTH - 1; i > 0; i--) {
      points[i].copy(points[i - 1])
    }
    points[0].copy(headRef.current)

    // Rainbow hue cycling
    const hue = ((ribbonIndex / RIBBON_COUNT) * 360 + t * 20) % 360
    _col.setHSL(hue / 360, 1.0, 0.6)

    for (let i = 0; i < TRAIL_LENGTH; i++) {
      const p = points[i]
      positions[i * 3] = p.x
      positions[i * 3 + 1] = p.y
      positions[i * 3 + 2] = p.z

      const fade = i / (TRAIL_LENGTH - 1)
      const brightness = Math.pow(1 - fade, 1.5) * 2.0
      colors[i * 3] = _col.r * brightness
      colors[i * 3 + 1] = _col.g * brightness
      colors[i * 3 + 2] = _col.b * brightness
    }

    if (lineRef.current) {
      lineRef.current.geometry.attributes.position.needsUpdate = true
      lineRef.current.geometry.attributes.color.needsUpdate = true
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

export default function RibbonBall() {
  const groupRef = useRef()
  const { scene } = useThree()

  const ribbons = useMemo(() => {
    const result = []
    for (let i = 0; i < RIBBON_COUNT; i++) {
      const rng = makeRng(i * 777 + 13)

      // Random start position scattered inside sphere
      const r = (0.1 + rng() * 0.7) * SPHERE_RADIUS
      const theta = rng() * Math.PI * 2
      const phi = Math.acos(2 * rng() - 1)
      const startPos = new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      )

      // Random unit velocity
      const theta2 = rng() * Math.PI * 2
      const phi2 = Math.acos(2 * rng() - 1)
      const startVel = new THREE.Vector3(
        Math.sin(phi2) * Math.cos(theta2),
        Math.sin(phi2) * Math.sin(theta2),
        Math.cos(phi2)
      )

      // Unique orbit axis for calm-mode arcs — different plane per ribbon
      const theta3 = rng() * Math.PI * 2
      const phi3 = Math.acos(2 * rng() - 1)
      const orbitAxis = new THREE.Vector3(
        Math.sin(phi3) * Math.cos(theta3),
        Math.sin(phi3) * Math.sin(theta3),
        Math.cos(phi3)
      )

      result.push({ ribbonIndex: i, startPos, startVel, orbitAxis })
    }
    return result
  }, [])

  useFrame(() => {
    const { ribbonPos = [7, 0, 0] } = scene.userData
    if (groupRef.current) {
      groupRef.current.position.set(ribbonPos[0], ribbonPos[1], ribbonPos[2])
    }
  })

  return (
    <group ref={groupRef}>
      {ribbons.map((props, i) => (
        <SingleRibbon key={i} {...props} />
      ))}
    </group>
  )
}
