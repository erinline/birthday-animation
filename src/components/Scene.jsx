import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import DustBall from './DustBall'
import RibbonBall from './RibbonBall'
import Background from './Background'
import Effects from './Effects'
import QuasarPulse from './QuasarPulse'

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

  if (!scene.userData.initialized) {
    scene.userData.initialized = true
    scene.userData.phase = 'IDLE'
    scene.userData.agitation = 0.0
    scene.userData.dustPos = [-7, 0, 0]
    scene.userData.ribbonPos = [7, 0, 0]
    scene.userData.bloomIntensity = 1.5
    scene.userData.ballScale = 1.0
    scene.userData.pulseIntensity = 0.0
  }

  useFrame((state, delta) => {
    const tl = timelineRef.current
    tl.phaseElapsed += delta

    // --- Phase transitions ---
    switch (tl.phase) {
      case 'IDLE':
        if (tl.started) {
          tl.phase = 'DUST_TEXT'; tl.phaseElapsed = 0
          onPhaseChange('DUST_TEXT')
        }
        break
      case 'DUST_TEXT':
        if (tl.phaseElapsed > 4.5) {
          tl.phase = 'SWIPE'; tl.phaseElapsed = 0
          onPhaseChange('RUNNING')
        }
        break
      case 'SWIPE':
        if (tl.phaseElapsed > 0.4) {
          tl.phase = 'RIBBON_TEXT'; tl.phaseElapsed = 0
          onPhaseChange('RIBBON_TEXT')
        }
        break
      case 'RIBBON_TEXT':
        if (tl.phaseElapsed > 4.5) {
          tl.phase = 'ZOOM_OUT'; tl.phaseElapsed = 0
          onPhaseChange('RUNNING')
        }
        break
      case 'TOGETHER_TEXT':
        if (tl.phaseElapsed > 4.5) {
          tl.phase = 'APPROACH'; tl.phaseElapsed = 0
          onPhaseChange('RUNNING')
        }
        break
      case 'ZOOM_OUT':
        if (tl.phaseElapsed > 3.0) {
          tl.phase = 'TOGETHER_TEXT'; tl.phaseElapsed = 0
          onPhaseChange('TOGETHER_TEXT')
        }
        break
      case 'APPROACH':
        if (tl.phaseElapsed > 4.0) { tl.phase = 'CONDENSE'; tl.phaseElapsed = 0 }
        break
      case 'CONDENSE':
        if (tl.phaseElapsed > 1.8) { tl.phase = 'EXPLOSION'; tl.phaseElapsed = 0 }
        break
      case 'EXPLOSION':
        if (tl.phaseElapsed > 1.2) {
          tl.phase = 'FLASH_TEXT'; tl.phaseElapsed = 0
          onPhaseChange('EXPLOSION_TEXT')
        }
        break
      case 'FLASH_TEXT':
        if (tl.phaseElapsed > 8.0) {
          tl.phase = 'SETTLE'; tl.phaseElapsed = 0
          onPhaseChange('CALM')
        }
        break
      case 'SETTLE':
        if (tl.phaseElapsed > 6.0) {
          tl.phase = 'CALM'; tl.phaseElapsed = 0
        }
        break
    }

    const p = tl.phase
    const elapsed = tl.phaseElapsed

    // --- Ball positions ---
    let dustPos = [-7, 0, 0]
    let ribbonPos = [7, 0, 0]

    if (p === 'TOGETHER_TEXT') {
      const t = easeInOut(Math.min(elapsed / 8.5, 1))
      dustPos = [lerp(-7, 0, t), 0, 0]
      ribbonPos = [lerp(7, 0, t), 0, 0]
    } else if (p === 'APPROACH') {
      const t = easeInOut(Math.min((4.5 + elapsed) / 8.5, 1))
      dustPos = [lerp(-7, 0, t), 0, 0]
      ribbonPos = [lerp(7, 0, t), 0, 0]
    } else if (p === 'CONDENSE' || p === 'EXPLOSION' || p === 'FLASH_TEXT' || p === 'SETTLE' || p === 'CALM') {
      dustPos = [0, 0, 0]
      ribbonPos = [0, 0, 0]
    }

    // --- Ball scale (condense → flash → expand) ---
    let ballScale = 1.0
    if (p === 'CONDENSE') {
      ballScale = lerp(1.0, 0.04, easeInOut(Math.min(elapsed / 1.8, 1)))
    } else if (p === 'EXPLOSION' || p === 'FLASH_TEXT') {
      ballScale = 0.03
    } else if (p === 'SETTLE') {
      ballScale = easeInOut(Math.min(elapsed / 3.5, 1))
    }

    // --- Pulse intensity (bell curve over EXPLOSION phase) ---
    let pulseIntensity = 0.0
    if (p === 'EXPLOSION') {
      const t = elapsed / 1.2
      pulseIntensity = Math.sin(t * Math.PI)
    }

    // --- Agitation ---
    let agitation = 0.0
    if (p === 'RIBBON_TEXT' || p === 'ZOOM_OUT' || p === 'APPROACH' || p === 'CONDENSE' || p === 'EXPLOSION' || p === 'TOGETHER_TEXT') {
      agitation = 1.0
    } else if (p === 'SWIPE') {
      agitation = easeInOut(Math.min(elapsed / 0.4, 1))
    } else if (p === 'SETTLE') {
      agitation = 1.0 - smoothstep(Math.min(elapsed / 6.0, 1))
    }

    // --- Bloom intensity ---
    let bloomIntensity = 1.5
    if (p === 'CONDENSE') {
      bloomIntensity = lerp(1.5, 4.0, easeInOut(Math.min(elapsed / 1.8, 1)))
    } else if (p === 'EXPLOSION') {
      const t = elapsed / 1.2
      bloomIntensity = 4.0 + Math.sin(t * Math.PI) * 26.0
    } else if (p === 'FLASH_TEXT') {
      bloomIntensity = lerp(4.0, 1.5, Math.min(elapsed / 5.0, 1))
    } else if (p === 'SETTLE') {
      bloomIntensity = lerp(4.0, 1.5, Math.min(elapsed / 6.0, 1))
    }

    // --- Camera ---
    let camX = -7, camY = 0, camZ = 12
    let lookX = -7

    switch (p) {
      case 'IDLE':
      case 'DUST_TEXT':
        camX = -7; camZ = 12; lookX = -7
        break
      case 'SWIPE': {
        const t = easeInOut(Math.min(elapsed / 0.4, 1))
        camX = lerp(-7, 7, t)
        lookX = lerp(-7, 7, t)
        camZ = 12
        break
      }
      case 'RIBBON_TEXT':
        camX = 7; camZ = 12; lookX = 7
        break
      case 'ZOOM_OUT': {
        const t = easeInOut(Math.min(elapsed / 3.0, 1))
        camX = lerp(7, 0, t)
        camZ = lerp(12, 22, t)
        lookX = lerp(7, 0, t)
        break
      }
      case 'TOGETHER_TEXT':
      case 'APPROACH':
        camX = 0; camZ = 22; lookX = 0
        break
      case 'CONDENSE': {
        // Slowly drift closer as the balls compress
        const t = easeInOut(Math.min(elapsed / 1.8, 1))
        camX = 0; camZ = lerp(22, 17, t); lookX = 0
        break
      }
      case 'EXPLOSION': {
        const shake = 0.25
        camX = (Math.random() - 0.5) * shake * 2
        camY = (Math.random() - 0.5) * shake * 2
        camZ = 17 + (Math.random() - 0.5) * 0.3
        lookX = 0
        break
      }
      case 'FLASH_TEXT':
        camX = 0; camZ = 17; lookX = 0
        break
      case 'SETTLE': {
        const t = smoothstep(Math.min(elapsed / 6.0, 1))
        camX = 0
        camZ = lerp(17, 14, t)
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

    scene.userData.phase = p
    scene.userData.agitation = agitation
    scene.userData.dustPos = dustPos
    scene.userData.ribbonPos = ribbonPos
    scene.userData.bloomIntensity = bloomIntensity
    scene.userData.ballScale = ballScale
    scene.userData.pulseIntensity = pulseIntensity
  })

  return (
    <>
      <DustBall />
      <RibbonBall />
      <QuasarPulse />
      <Background />
      <Effects />
    </>
  )
}
