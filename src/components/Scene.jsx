import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import DustBall from './DustBall'
import RibbonBall from './RibbonBall'
import Background from './Background'
import Effects from './Effects'

function smoothstep(t) {
  t = Math.max(0, Math.min(1, t))
  return t * t * (3 - 2 * t)
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function easeInOut(t) {
  t = Math.max(0, Math.min(1, t))
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

const _lookAt = new THREE.Vector3()

export default function Scene({ timelineRef, onPhaseChange }) {
  const { camera, scene } = useThree()

  // Initialize scene.userData defaults
  if (!scene.userData.initialized) {
    scene.userData.initialized = true
    scene.userData.phase = 'IDLE'
    scene.userData.agitation = 1.0
    scene.userData.dustPos = [-7, 0, 0]
    scene.userData.ribbonPos = [7, 0, 0]
    scene.userData.bloomIntensity = 1.5
  }

  useFrame((state, delta) => {
    const tl = timelineRef.current
    tl.phaseElapsed += delta

    // --- Phase transitions ---
    switch (tl.phase) {
      case 'IDLE':
        if (tl.started) { tl.phase = 'SWIPE'; tl.phaseElapsed = 0 }
        break
      case 'SWIPE':
        if (tl.phaseElapsed > 0.4) { tl.phase = 'RIBBONS'; tl.phaseElapsed = 0 }
        break
      case 'RIBBONS':
        if (tl.phaseElapsed > 4.0) { tl.phase = 'ZOOM_OUT'; tl.phaseElapsed = 0 }
        break
      case 'ZOOM_OUT':
        if (tl.phaseElapsed > 3.0) { tl.phase = 'APPROACH'; tl.phaseElapsed = 0 }
        break
      case 'APPROACH':
        if (tl.phaseElapsed > 4.0) { tl.phase = 'EXPLOSION'; tl.phaseElapsed = 0 }
        break
      case 'EXPLOSION':
        if (tl.phaseElapsed > 2.5) {
          tl.phase = 'SETTLE'
          tl.phaseElapsed = 0
          onPhaseChange('CALM') // text fades in during SETTLE via CSS delay
        }
        break
      case 'SETTLE':
        if (tl.phaseElapsed > 6.0) {
          tl.phase = 'CALM'
          tl.phaseElapsed = 0
        }
        break
    }

    const p = tl.phase
    const elapsed = tl.phaseElapsed

    // --- Ball positions ---
    let dustPos = [-7, 0, 0]
    let ribbonPos = [7, 0, 0]

    if (p === 'APPROACH') {
      const t = easeInOut(Math.min(elapsed / 4.0, 1))
      dustPos = [lerp(-7, 0, t), 0, 0]
      ribbonPos = [lerp(7, 0, t), 0, 0]
    } else if (p === 'EXPLOSION' || p === 'SETTLE' || p === 'CALM') {
      dustPos = [0, 0, 0]
      ribbonPos = [0, 0, 0]
    }

    // --- Agitation ---
    let agitation = 1.0
    if (p === 'SETTLE') {
      agitation = 1.0 - smoothstep(Math.min(elapsed / 6.0, 1))
    } else if (p === 'CALM') {
      agitation = 0.0
    }

    // --- Bloom intensity ---
    let bloomIntensity = 1.5
    if (p === 'EXPLOSION') {
      bloomIntensity = 3.5
    } else if (p === 'SETTLE') {
      bloomIntensity = lerp(3.5, 1.5, Math.min(elapsed / 6.0, 1))
    }

    // --- Camera ---
    let camX = -7, camY = 0, camZ = 12
    let lookX = -7

    switch (p) {
      case 'IDLE':
        camX = -7; camZ = 12; lookX = -7
        break
      case 'SWIPE': {
        const t = easeInOut(Math.min(elapsed / 0.4, 1))
        camX = lerp(-7, 7, t)
        lookX = lerp(-7, 7, t)
        camZ = 12
        break
      }
      case 'RIBBONS':
        camX = 7; camZ = 12; lookX = 7
        break
      case 'ZOOM_OUT': {
        const t = easeInOut(Math.min(elapsed / 3.0, 1))
        camX = lerp(7, 0, t)
        camZ = lerp(12, 22, t)
        lookX = lerp(7, 0, t)
        break
      }
      case 'APPROACH':
        camX = 0; camZ = 22; lookX = 0
        break
      case 'EXPLOSION': {
        const shake = 0.15
        camX = (Math.random() - 0.5) * shake * 2
        camY = (Math.random() - 0.5) * shake * 2
        camZ = 22 + (Math.random() - 0.5) * shake * 0.5
        lookX = 0
        break
      }
      case 'SETTLE': {
        const t = smoothstep(Math.min(elapsed / 6.0, 1))
        camX = 0
        camZ = lerp(22, 14, t)
        lookX = 0
        break
      }
      case 'CALM':
        camX = 0; camZ = 14; lookX = 0
        break
    }

    camera.position.set(camX, camY, camZ)
    _lookAt.set(lookX, 0, 0)
    camera.lookAt(_lookAt)

    // --- Push state to scene.userData for child components ---
    scene.userData.phase = p
    scene.userData.agitation = agitation
    scene.userData.dustPos = dustPos
    scene.userData.ribbonPos = ribbonPos
    scene.userData.bloomIntensity = bloomIntensity
  })

  return (
    <>
      <DustBall />
      <RibbonBall />
      <Background />
      <Effects />
    </>
  )
}
