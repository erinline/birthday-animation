import { useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const RIBBON_COUNT = 20
const TRAIL_LENGTH = 80
const SPHERE_RADIUS = 3.0
const SOFT_RADIUS = 2.5

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

    // mergeProgress: 0 when far apart, 1 when fully merged
    const { dustPos = [-7, 0, 0], ribbonPos = [7, 0, 0] } = scene.userData
    const mergeProgress = Math.max(0, 1.0 - Math.abs(dustPos[0]) / 5.0)

    const speed = 0.03 + agitation * 0.09

    headRef.current.addScaledVector(velRef.current, speed)

    const dist = headRef.current.length()

    // Soft inward spring (calm mode)
    if (calm > 0.01 && dist > SOFT_RADIUS) {
      _normal.copy(headRef.current).normalize()
      const excess = dist - SOFT_RADIUS
      velRef.current.addScaledVector(_normal, -excess * 0.018 * calm)
      velRef.current.normalize()
    }

    // Hard sphere reflection (agitated mode)
    if (dist >= SPHERE_RADIUS) {
      _normal.copy(headRef.current).normalize()
      const dot = velRef.current.dot(_normal)
      velRef.current.addScaledVector(_normal, -2 * dot)
      velRef.current.normalize()
      headRef.current.copy(_normal).multiplyScalar(SPHERE_RADIUS - 0.01)
    }

    // Looping arcs (calm mode)
    if (calm > 0.01) {
      velRef.current.applyAxisAngle(orbitAxis, 0.015 * calm)
      velRef.current.normalize()
    }

    // ── Dust cluster attraction (post-merge) ─────────────────────────────────
    // Each ribbon reads the centroid of its own paired dust particles. Those
    // particles have been pulled toward this ribbon, so their centroid lags just
    // behind the ribbon head — pulling the ribbon back creates a feedback loop
    // that warps the arc toward wherever its dust cloud is densest.
    const rc = scene.userData.ribbonClusters
    if (rc && mergeProgress > 0.01 && calm > 0.01) {
      const j3 = ribbonIndex * 3
      // Cluster centroid is in world space; convert to ribbon-local
      const cx = rc[j3]     - ribbonPos[0]
      const cy = rc[j3 + 1] - ribbonPos[1]
      const cz = rc[j3 + 2] - ribbonPos[2]

      const dx = cx - headRef.current.x
      const dy = cy - headRef.current.y
      const dz = cz - headRef.current.z
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.1

      const nudge = mergeProgress * calm * 0.04
      velRef.current.x += (dx / d) * nudge
      velRef.current.y += (dy / d) * nudge
      velRef.current.z += (dz / d) * nudge
      velRef.current.normalize()
    }

    // ── Write head position in world space for DustBall to read ──────────────
    const rh = scene.userData.ribbonHeads
    if (rh) {
      rh[ribbonIndex * 3]     = headRef.current.x + ribbonPos[0]
      rh[ribbonIndex * 3 + 1] = headRef.current.y + ribbonPos[1]
      rh[ribbonIndex * 3 + 2] = headRef.current.z + ribbonPos[2]
    }

    // Shift ring buffer
    for (let i = TRAIL_LENGTH - 1; i > 0; i--) {
      points[i].copy(points[i - 1])
    }
    points[0].copy(headRef.current)

    const hue = ((ribbonIndex / RIBBON_COUNT) * 360 + t * 20) % 360
    _col.setHSL(hue / 360, 1.0, 0.68)

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
        <bufferAttribute attach="attributes-position" array={positions} count={TRAIL_LENGTH} itemSize={3} />
        <bufferAttribute attach="attributes-color" array={colors} count={TRAIL_LENGTH} itemSize={3} />
      </bufferGeometry>
      <lineBasicMaterial vertexColors toneMapped={false} />
    </line>
  )
}

export default function RibbonBall() {
  const groupRef = useRef()
  const { scene } = useThree()

  // Allocate shared ribbon-heads array once; SingleRibbons write into it each frame
  useMemo(() => {
    scene.userData.ribbonHeads = new Float32Array(RIBBON_COUNT * 3)
    scene.userData.ribbonClusters = new Float32Array(RIBBON_COUNT * 3)
  }, [scene])

  const ribbons = useMemo(() => {
    const result = []
    for (let i = 0; i < RIBBON_COUNT; i++) {
      const rng = makeRng(i * 777 + 13)

      const r = (0.1 + rng() * 0.7) * SPHERE_RADIUS
      const theta = rng() * Math.PI * 2
      const phi = Math.acos(2 * rng() - 1)
      const startPos = new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      )

      const theta2 = rng() * Math.PI * 2
      const phi2 = Math.acos(2 * rng() - 1)
      const startVel = new THREE.Vector3(
        Math.sin(phi2) * Math.cos(theta2),
        Math.sin(phi2) * Math.sin(theta2),
        Math.cos(phi2)
      )

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
