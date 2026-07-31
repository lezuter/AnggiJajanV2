'use client'

import { useFrame } from '@react-three/fiber'
import {
  Center,
  Environment,
  Lightformer,
  useGLTF,
  View
} from '@react-three/drei'
import { Suspense, useMemo, useRef } from 'react'
import { Mesh, MeshPhysicalMaterial } from 'three'
import type { Group, Material } from 'three'

const MODEL_PATH = '/animations/model_1781361231466.gltf'

interface Stick3DLogoProps {
  className?: string
  scale?: number
}

function ChromeStudioRig () {
  const purpleStrip = useRef<Group>(null)
  const blueStrip = useRef<Group>(null)

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime()
    const purpleSweep = Math.sin(time * 0.78)
    const blueSweep = Math.sin(time * 0.7 + 1.65)

    if (purpleStrip.current) {
      purpleStrip.current.position.x = -0.85 + purpleSweep * 1.15
      purpleStrip.current.position.y = 0.1 + Math.sin(time * 0.42) * 0.07
      purpleStrip.current.rotation.y = -0.16 + purpleSweep * 0.12
    }

    if (blueStrip.current) {
      blueStrip.current.position.x = 0.85 + blueSweep * 1.15
      blueStrip.current.position.y =
        0.1 + Math.sin(time * 0.38 + 0.9) * 0.07
      blueStrip.current.rotation.y = 0.16 - blueSweep * 0.12
    }
  })

  return (
    <Environment resolution={256} frames={Infinity}>
      <Lightformer
        form='rect'
        intensity={1.8}
        position={[0, 0.5, 4]}
        scale={[5.4, 4, 1]}
        target={[0, 0, 0]}
        color='#f8fafc'
      />

      <Lightformer
        form='rect'
        intensity={1}
        position={[0, 3.5, 0.75]}
        scale={[5.5, 0.65, 1]}
        target={[0, 0, 0]}
        color='#ffffff'
      />

      <Lightformer
        form='rect'
        intensity={1}
        position={[0, 0.65, -4]}
        scale={[4.8, 3, 1]}
        target={[0, 0, 0]}
        color='#dbeafe'
      />

      <group
        ref={purpleStrip}
        position={[-0.85, 0.1, 0]}
        rotation={[0, -0.16, 0]}
      >
        <Lightformer
          form='rect'
          intensity={3.6}
          position={[0, 0, 3.2]}
          scale={[0.4, 5.2, 1]}
          target={[0, 0, 0]}
          color='#a855f7'
        />
      </group>

      <group
        ref={blueStrip}
        position={[2, 0.15, 0]}
        rotation={[0, 0.04, 0]}
      >
        <Lightformer
          form='rect'
          intensity={3.4}
          position={[0, 0, 3.2]}
          scale={[0.4, 5.2, 1]}
          target={[0, 0, 0]}
          color='#3b82f6'
        />
      </group>
    </Environment>
  )
}

function createChromeMaterial (source: Material): MeshPhysicalMaterial {
  return new MeshPhysicalMaterial({
    color: '#cbd3dc',
    metalness: 1,
    roughness: 0.1,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    envMapIntensity: 3,
    opacity: source.opacity,
    transparent: source.transparent,
    alphaTest: source.alphaTest,
    side: source.side,
    depthWrite: source.depthWrite
  })
}

function StickModel ({ scale }: { scale: number }) {
  const { scene } = useGLTF(MODEL_PATH)

  const chromeScene = useMemo(() => {
    const clonedScene = scene.clone(true)

    clonedScene.traverse(object => {
      if (!(object instanceof Mesh)) return

      object.material = Array.isArray(object.material)
        ? object.material.map(createChromeMaterial)
        : createChromeMaterial(object.material)

      object.castShadow = false
      object.receiveShadow = false
    })

    return clonedScene
  }, [scene])

  return (
    <Center>
      <primitive object={chromeScene} scale={scale} />
    </Center>
  )
}

export default function Stick3DLogo ({
  className = 'h-11 w-11',
  scale = 0.028
}: Stick3DLogoProps) {
  return (
    <div className={`pointer-events-none ${className}`} aria-hidden='true'>
      <View className='h-full w-full pointer-events-none'>
        <ChromeStudioRig />

        <Suspense fallback={null}>
          <StickModel scale={scale} />
        </Suspense>
      </View>
    </div>
  )
}

useGLTF.preload(MODEL_PATH)
