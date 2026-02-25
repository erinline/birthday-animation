import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { EffectComposer, Bloom, ChromaticAberration } from '@react-three/postprocessing'

function DynamicEffects({ bloomRef, caRef }) {
  const { scene } = useThree()

  useFrame(() => {
    const { bloomIntensity = 1.5, phase = 'IDLE' } = scene.userData

    if (bloomRef.current) {
      bloomRef.current.intensity = bloomIntensity
    }

    if (caRef.current?.offset) {
      let ox = 0, oy = 0
      if (phase === 'SWIPE') { ox = 0.008 }
      else if (phase === 'EXPLOSION') { ox = 0.005; oy = 0.005 }
      caRef.current.offset.x = ox
      caRef.current.offset.y = oy
    }
  })

  return null
}

export default function Effects() {
  const bloomRef = useRef()
  const caRef = useRef()

  return (
    <>
      <DynamicEffects bloomRef={bloomRef} caRef={caRef} />
      <EffectComposer>
        <Bloom
          ref={bloomRef}
          luminanceThreshold={0.2}
          intensity={1.5}
          mipmapBlur
        />
        <ChromaticAberration
          ref={caRef}
          offset={[0, 0]}
        />
      </EffectComposer>
    </>
  )
}
