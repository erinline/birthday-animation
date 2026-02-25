import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

export default function useMouse() {
  const mouseWorld = useRef(new THREE.Vector3(9999, 9999, 0))
  const { camera, gl } = useThree()

  useEffect(() => {
    const canvas = gl.domElement
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
    const raycaster = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    const target = new THREE.Vector3()

    function onPointerMove(e) {
      const rect = canvas.getBoundingClientRect()
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(ndc, camera)
      raycaster.ray.intersectPlane(plane, target)
      mouseWorld.current.copy(target)
    }

    canvas.addEventListener('pointermove', onPointerMove)
    return () => canvas.removeEventListener('pointermove', onPointerMove)
  }, [camera, gl])

  return mouseWorld
}
