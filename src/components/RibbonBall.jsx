import { useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { createNoise3D } from 'simplex-noise'

const RIBBON_COUNT = 30
const TRAIL_LENGTH = 80

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

// Fibonacci sphere distribution
function fibSphereDir(i, n) {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5))
  const y = 1 - (i / (n - 1)) * 2
  const r = Math.sqrt(Math.max(0, 1 - y * y))
  const theta = goldenAngle * i
  return new THREE.Vector3(r * Math.cos(theta), y, r * Math.sin(theta)).normalize()
}

// Pre-allocated scratch vectors to reduce allocations in useFrame
const _headLocal = new THREE.Vector3()
const _homeTarget = new THREE.Vector3()
const _pullVec = new THREE.Vector3()
const _spikeVec = new THREE.Vector3()
const _noiseDir = new THREE.Vector3()
const _tangent = new THREE.Vector3()
const _upAxis = new THREE.Vector3(0, 1, 0)
const _moveDelta = new THREE.Vector3()
const _col = new THREE.Color()

function SingleRibbon({ ribbonIndex, homeDir, noiseOffset, groupRef }) {
  const { scene } = useThree()
  const lineRef = useRef()

  const noise3D = useMemo(() => {
    const rng = makeRng(ribbonIndex * 999 + 7777)
    return createNoise3D(rng)
  }, [ribbonIndex])

  const { positions, colors, points } = useMemo(() => {
    const positions = new Float32Array(TRAIL_LENGTH * 3)
    const colors = new Float32Array(TRAIL_LENGTH * 3)
    const points = []
    // Start at homeDir * 3 in local (group) space
    const sx = homeDir.x * 3
    const sy = homeDir.y * 3
    const sz = homeDir.z * 3
    for (let i = 0; i < TRAIL_LENGTH; i++) {
      points.push(new THREE.Vector3(sx, sy, sz))
      positions[i * 3] = sx
      positions[i * 3 + 1] = sy
      positions[i * 3 + 2] = sz
    }
    return { positions, colors, points }
  }, [homeDir])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const agitation = scene.userData.agitation ?? 1.0

    // Interpolated parameters
    const noiseFreq = 0.15 + agitation * 0.65
    const stepSize = 0.02 + agitation * 0.05
    const TARGET_RADIUS = 2.5

    // Head in local space
    _headLocal.copy(points[0])
    const distFromOrigin = _headLocal.length()

    // Noise direction
    const nx = _headLocal.x * noiseFreq + noiseOffset
    const ny = _headLocal.y * noiseFreq + noiseOffset
    const nz = _headLocal.z * noiseFreq + t * 0.5

    const angle = noise3D(nx, ny, nz) * Math.PI * 2
    const angle2 = noise3D(nx + 100, ny + 100, nz) * Math.PI

    _noiseDir.set(
      Math.cos(angle) * Math.sin(angle2),
      Math.sin(angle) * Math.sin(angle2),
      Math.cos(angle2)
    )

    _moveDelta.set(0, 0, 0)

    if (agitation > 0) {
      // Pull toward homeDir * 3
      _homeTarget.copy(homeDir).multiplyScalar(3)
      _pullVec.copy(_homeTarget).sub(_headLocal)
      if (_pullVec.lengthSq() > 0.0001) {
        _pullVec.normalize().multiplyScalar((0.03 + agitation * 0.02) * agitation)
        _moveDelta.add(_pullVec)
      }

      // Spike along homeDir
      const spikeMag = Math.pow(Math.max(0, Math.sin(t * 4 + noiseOffset)), 3) * 0.15 * agitation
      _spikeVec.copy(homeDir).multiplyScalar(spikeMag)
      _moveDelta.add(_spikeVec)

      // Noise contribution (agitated)
      _moveDelta.addScaledVector(_noiseDir, stepSize * agitation)
    }

    if (agitation < 1.0) {
      const calm = 1.0 - agitation
      // Tangential orbit
      const headNorm = _headLocal.clone().normalize()
      _tangent.crossVectors(headNorm, _upAxis).normalize()
      _moveDelta.addScaledVector(_tangent, 0.3 * calm * stepSize)

      // Radius correction
      const radiusError = TARGET_RADIUS - distFromOrigin
      _moveDelta.addScaledVector(headNorm, radiusError * 0.05 * calm)

      // Soft noise (calm)
      _moveDelta.addScaledVector(_noiseDir, stepSize * calm * 0.3)
    }

    _headLocal.add(_moveDelta)

    // Shift ring buffer
    for (let i = TRAIL_LENGTH - 1; i > 0; i--) {
      points[i].copy(points[i - 1])
    }
    points[0].copy(_headLocal)

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
      const homeDir = fibSphereDir(i, RIBBON_COUNT)
      const noiseOffset = i * 137.508
      result.push({ ribbonIndex: i, homeDir, noiseOffset })
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
        <SingleRibbon key={i} {...props} groupRef={groupRef} />
      ))}
    </group>
  )
}
