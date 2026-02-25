import { EffectComposer, Bloom } from '@react-three/postprocessing'

export default function Effects() {
  return (
    <EffectComposer>
      <Bloom
        luminanceThreshold={0.2}
        intensity={1.5}
        mipmapBlur
      />
    </EffectComposer>
  )
}
