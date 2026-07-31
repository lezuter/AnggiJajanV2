'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

interface CyberneticGridShaderProps {
  className?: string
}

export default function CyberneticGridShader ({
  className = ''
}: CyberneticGridShaderProps) {
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

        float t = iTime * 0.2;
        float mouseDist = length(uv - mouse);

        float warp = sin(mouseDist * 20.0 - t * 4.0) * 0.1;
        warp *= smoothstep(0.4, 0.0, mouseDist);
        uv += warp;

        vec2 gridUv = abs(fract(uv * 16.0) - 0.5);
        float line = pow(1.0 - min(gridUv.x, gridUv.y), 50.0);

        vec3 gridColor = vec3(0.1, 0.5, 1.0);
        vec3 color = gridColor
                   * line
                   * (0.5 + sin(t * 2.0) * 0.2);

        float energy = sin(uv.x * 20.0 + t * 5.0)
                     * sin(uv.y * 20.0 + t * 3.0);
        energy = smoothstep(0.8, 1.0, energy);
        color += vec3(1.0, 0.2, 0.8) * energy * line;

        float glow = smoothstep(0.1, 0.0, mouseDist);
        color += vec3(1.0) * glow * 0.5;

        color += random(uv + t * 0.1) * 0.05;

        gl_FragColor = vec4(color, 1.0);
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

    const lastPointer = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2
    }

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms
    })

    const geometry = new THREE.PlaneGeometry(2, 2)
    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    const updateMousePosition = () => {
      const bounds = container.getBoundingClientRect()

      uniforms.iMouse.value.set(
        lastPointer.x - bounds.left,
        bounds.height - (lastPointer.y - bounds.top)
      )
    }

    const onResize = () => {
      const width = container.clientWidth
      const height = container.clientHeight

      if (width <= 0 || height <= 0) return

      renderer.setSize(width, height, false)
      uniforms.iResolution.value.set(width, height)
      updateMousePosition()
    }

    const onPointerMove = (event: PointerEvent) => {
      lastPointer.x = event.clientX
      lastPointer.y = event.clientY
      updateMousePosition()
    }

    const onScroll = () => updateMousePosition()

    const renderFrame = () => {
      uniforms.iTime.value = clock.getElapsedTime()
      renderer.render(scene, camera)
    }

    const resizeObserver = new ResizeObserver(onResize)
    resizeObserver.observe(container)

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('scroll', onScroll, {
      passive: true,
      capture: true
    })
    onResize()
    renderer.setAnimationLoop(renderFrame)

    const visibilityObserver = new IntersectionObserver(
      entries => {
        const isVisible = entries[0]?.isIntersecting ?? true
        renderer.setAnimationLoop(isVisible ? renderFrame : null)

        if (isVisible) renderFrame()
      },
      { rootMargin: '160px 0px' }
    )

    visibilityObserver.observe(container)

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('scroll', onScroll, true)
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
      className={`pointer-events-none absolute inset-0 z-0 overflow-hidden ${className}`}
      aria-hidden='true'
    />
  )
}
