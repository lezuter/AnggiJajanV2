'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

interface ChromeBloomGridShaderProps {
  className?: string
}

export default function ChromeBloomGridShader ({
  className = ''
}: ChromeBloomGridShaderProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.setClearColor(0x000000, 0)
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const clock = new THREE.Clock()
    const reducedMotionQuery = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    )

    const vertexShader = `
      void main() {
        gl_Position = vec4(position, 1.0);
      }
    `

    const fragmentShader = `
      precision highp float;
      uniform vec2 iResolution;
      uniform float iTime;
      uniform vec2 iMouse;

      float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898, 78.233)))
                     * 43758.5453123);
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy)
                  / iResolution.y;
        vec2 mouse = (iMouse - 0.5 * iResolution.xy)
                     / iResolution.y;

        float t = iTime * 0.16;
        float mouseDist = length(uv - mouse);

        float warp = sin(mouseDist * 18.0 - t * 4.0) * 0.085;
        warp *= smoothstep(0.44, 0.0, mouseDist);
        uv += warp;

        vec2 gridUv = abs(fract(uv * 15.0) - 0.5);
        float line = pow(1.0 - min(gridUv.x, gridUv.y), 54.0);

        vec3 deepPlum = vec3(0.095, 0.072, 0.10);
        vec3 gunmetal = vec3(0.31, 0.29, 0.32);
        vec3 silverPearl = vec3(0.78, 0.76, 0.80);
        vec3 mutedRose = vec3(0.46, 0.33, 0.39);
        vec3 coolReflection = vec3(0.43, 0.40, 0.46);

        float reflectedBand = 0.5 + 0.5 * sin(
          uv.x * 7.0 - uv.y * 4.0 + t * 2.4
        );
        vec3 metal = mix(
          deepPlum,
          gunmetal,
          0.42 + reflectedBand * 0.30
        );
        metal = mix(metal, mutedRose, reflectedBand * 0.11);
        metal = mix(metal, silverPearl, pow(reflectedBand, 10.0) * 0.32);

        vec3 color = metal
                   * line
                   * (0.29 + sin(t * 2.0) * 0.055);

        float energy = sin(uv.x * 20.0 + t * 5.0)
                     * sin(uv.y * 20.0 + t * 3.0);
        energy = smoothstep(0.82, 1.0, energy);
        color += mix(mutedRose, coolReflection, 0.38)
               * energy
               * line
               * 0.26;

        float specular = smoothstep(0.13, 0.0, mouseDist);
        color += silverPearl * specular * 0.22;
        color += random(uv + t * 0.1) * 0.014;

        float alpha = clamp(
          line * 0.55 + energy * line * 0.1 + specular * 0.08,
          0.0,
          0.58
        );

        gl_FragColor = vec4(color, alpha);
      }
    `

    const uniforms = {
      iTime: { value: 0 },
      iResolution: { value: new THREE.Vector2() },
      iMouse: {
        value: new THREE.Vector2(
          container.clientWidth / 2,
          container.clientHeight / 2
        )
      }
    }

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      transparent: true,
      depthWrite: false
    })
    const geometry = new THREE.PlaneGeometry(2, 2)
    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    const onResize = () => {
      const width = container.clientWidth
      const height = container.clientHeight

      if (width <= 0 || height <= 0) return

      renderer.setSize(width, height, false)
      uniforms.iResolution.value.set(width, height)
    }

    const onPointerMove = (event: PointerEvent) => {
      if (reducedMotionQuery.matches) return

      const bounds = container.getBoundingClientRect()
      uniforms.iMouse.value.set(
        event.clientX - bounds.left,
        bounds.height - (event.clientY - bounds.top)
      )
    }

    const renderFrame = () => {
      uniforms.iTime.value = reducedMotionQuery.matches
        ? 0
        : clock.getElapsedTime()
      renderer.render(scene, camera)
    }

    const updateAnimationLoop = (isVisible = true) => {
      renderer.setAnimationLoop(
        isVisible && !reducedMotionQuery.matches ? renderFrame : null
      )
      renderFrame()
    }

    const onReducedMotionChange = () => updateAnimationLoop()

    const resizeObserver = new ResizeObserver(onResize)
    resizeObserver.observe(container)
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    reducedMotionQuery.addEventListener('change', onReducedMotionChange)

    onResize()
    updateAnimationLoop()

    const visibilityObserver = new IntersectionObserver(
      entries => updateAnimationLoop(entries[0]?.isIntersecting ?? true),
      { rootMargin: '160px 0px' }
    )
    visibilityObserver.observe(container)

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      reducedMotionQuery.removeEventListener('change', onReducedMotionChange)
      resizeObserver.disconnect()
      visibilityObserver.disconnect()
      renderer.setAnimationLoop(null)
      renderer.domElement.remove()
      material.dispose()
      geometry.dispose()
      renderer.dispose()
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden='true'
    />
  )
}
