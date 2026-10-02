import * as THREE from 'three'

export function skyElevationBrightness(heightFraction) {
  return 0.6 + 0.4 * THREE.MathUtils.smoothstep(heightFraction, 0, 1)
}

// Fade the finished color so 60% brightness stays 60% after tone mapping.
export function withSkyBrightness(material, brightness) {
  const compile = material.onBeforeCompile, key = material.customProgramCacheKey()
  material.userData.skyBrightness = brightness
  material.onBeforeCompile = function (shader, renderer) {
    compile.call(this, shader, renderer)
    shader.uniforms.skyBrightness = brightness
    shader.fragmentShader = `uniform float skyBrightness;\n${shader.fragmentShader}`
      .replace('#include <colorspace_fragment>', '#include <colorspace_fragment>\ngl_FragColor.rgb *= skyBrightness;')
  }
  material.customProgramCacheKey = () => `${key}|sky-brightness`
  return material
}

function hash(x, y, z, seed) {
  let value = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647) ^ seed
  value = Math.imul(value ^ (value >>> 13), 1274126177)
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295
}

function noise(x, y, z, seed) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z)
  const ease = (t) => t * t * (3 - 2 * t)
  const fx = ease(x - ix), fy = ease(y - iy), fz = ease(z - iz)
  const mix = THREE.MathUtils.lerp
  return mix(
    mix(mix(hash(ix, iy, iz, seed), hash(ix + 1, iy, iz, seed), fx), mix(hash(ix, iy + 1, iz, seed), hash(ix + 1, iy + 1, iz, seed), fx), fy),
    mix(mix(hash(ix, iy, iz + 1, seed), hash(ix + 1, iy, iz + 1, seed), fx), mix(hash(ix, iy + 1, iz + 1, seed), hash(ix + 1, iy + 1, iz + 1, seed), fx), fy), fz,
  )
}

function fractal(x, y, z, seed) {
  return noise(x, y, z, seed) * 0.56 + noise(x * 2.1, y * 2.1, z * 2.1, seed) * 0.28 + noise(x * 4.3, y * 4.3, z * 4.3, seed) * 0.16
}

export function makeDirtTexture(size = 512) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const context = canvas.getContext('2d')
  const image = context.createImageData(size, size)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      // Sampling a torus keeps both edges seamless when the ground texture repeats.
      const u = x / size * Math.PI * 2
      const v = y / size * Math.PI * 2
      const radius = 8 + Math.cos(v) * 3
      const dust = fractal(Math.cos(u) * radius, Math.sin(u) * radius, Math.sin(v) * 3, 91)
      const grain = hash(x, y, 0, 91)
      const value = 64 + dust * 95 + grain * 26
      const pixel = (y * size + x) * 4
      image.data[pixel] = value
      image.data[pixel + 1] = value * 0.76
      image.data[pixel + 2] = value * 0.53
      image.data[pixel + 3] = 255
    }
  }
  context.putImageData(image, 0, 0)
  for (let i = 0; i < 4800; i += 1) {
    const x = hash(i, 0, 0, 71) * size, y = hash(i, 1, 0, 71) * size
    const radius = 0.3 + hash(i, 2, 0, 71) * 1.3
    context.fillStyle = i % 3 ? '#34281f45' : '#e6cc9770'
    context.beginPath()
    context.ellipse(x, y, radius * 1.4, radius * 0.65, i, 0, Math.PI * 2)
    context.fill()
  }
  return canvas
}

export function makePlanetTexture(palette, seed, style = {}, width = 512, height = 256) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  const image = context.createImageData(width, height)
  const colors = palette.map(value => new THREE.Color(value).convertLinearToSRGB())
  const color = new THREE.Color()
  for (let y = 0; y < height; y += 1) {
    const latitude = (y / height - 0.5) * Math.PI
    for (let x = 0; x < width; x += 1) {
      const longitude = x / width * Math.PI * 2
      const nx = Math.cos(latitude) * Math.cos(longitude)
      const ny = Math.sin(latitude)
      const nz = Math.cos(latitude) * Math.sin(longitude)
      const turbulence = fractal(nx * 4 + seed, ny * 4, nz * 4, seed)
      const detail = fractal(nx * 22, ny * 22, nz * 22, seed + 7)
      let value = style.bands
        ? 0.26 + noise(ny * 16 + turbulence * 0.9, seed, 0, seed) * 0.5 + Math.sin(ny * 115 + turbulence * 6) * 0.025 + (detail - 0.5) * 0.12
        : THREE.MathUtils.clamp((turbulence - 0.28) * 1.9 + (detail - 0.5) * 0.16, 0, 1)
      if (style.surface === 'dust') value = 0.3 + turbulence * 0.4 + (detail - 0.5) * 0.3
      if (style.surface === 'ice') {
        const cracks = 1 - THREE.MathUtils.smoothstep(Math.abs(detail - 0.49), 0.012, 0.07)
        value = 0.58 + turbulence * 0.42 - cracks * 0.45
      }
      if (style.surface === 'basalt') value = 0.1 + turbulence * 0.28 + THREE.MathUtils.smoothstep(detail, 0.57, 0.72) * 0.5
      if (style.surface === 'lunar') {
        const maria = 1 - THREE.MathUtils.smoothstep(fractal(nx * 2.8 + seed, ny * 2.8, nz * 2.8, seed + 29), 0.42, 0.53)
        value = 0.76 + (detail - 0.5) * 0.35 - maria * 0.53
      }
      if (style.surface === 'sulfur') {
        const vents = 1 - THREE.MathUtils.smoothstep(detail, 0.26, 0.35)
        value = THREE.MathUtils.lerp(0.15 + turbulence * 0.95 + (detail - 0.5) * 0.18, 0.03, vents * 0.9)
      }
      if (style.surface === 'rainbow') value = THREE.MathUtils.clamp((fractal(nx * 1.7 + seed, ny * 1.7, nz * 1.7, seed) - 0.2) * 1.7 + (detail - 0.5) * 0.035, 0, 1)
      if (!style.bands && !['lunar', 'sulfur', 'rainbow'].includes(style.surface)) value = THREE.MathUtils.lerp(value, 0.94, THREE.MathUtils.smoothstep(Math.abs(ny), 0.88, 0.99) * 0.65)
      const stop = THREE.MathUtils.clamp(value, 0, 0.999) * (colors.length - 1)
      const index = Math.floor(stop)
      color.copy(colors[index]).lerp(colors[index + 1], stop - index)
      let grain = style.surface === 'rainbow' ? 0.99 + detail * 0.02 : 0.94 + detail * 0.12
      for (const crater of style.craterData ?? []) {
        // Match SphereGeometry's UV orientation so rims follow the actual relief.
        const dot = -nx * crater.normal.x - ny * crater.normal.y + nz * crater.normal.z
        if (dot < Math.cos(crater.span * 2.4)) continue
        const d = Math.sqrt(Math.max(0, 2 - 2 * dot)) / crater.span
        const bowl = 1 - THREE.MathUtils.smoothstep(d, 0.2, 0.8)
        const rim = Math.exp(-(((d - 0.85) / 0.09) ** 2))
        const ejecta = (1 - THREE.MathUtils.smoothstep(d, 1, 2.4)) * THREE.MathUtils.smoothstep(detail, 0.45, 0.67)
        grain *= 1 - bowl * 0.38 + rim * 0.65 + ejecta * 0.12
      }
      const pixel = (y * width + x) * 4
      image.data[pixel] = color.r * 255 * grain
      image.data[pixel + 1] = color.g * 255 * grain
      image.data[pixel + 2] = color.b * 255 * grain
      image.data[pixel + 3] = 255
    }
  }
  context.putImageData(image, 0, 0)
  return canvas
}

export function makePlanetGeometry(radius, seed, style = {}, widthSegments = 128, heightSegments = 96) {
  const geometry = new THREE.SphereGeometry(radius, widthSegments, heightSegments)
  if (style.bands || style.craters === false) return geometry
  const craters = [], point = new THREE.Vector3()
  const lunar = style.surface === 'lunar'
  const craterCount = lunar ? 32 : 16 + Math.floor(hash(0, 4, 0, seed) * 9)
  for (let i = 0; i < 128 && craters.length < craterCount; i++) {
    const y = hash(i, 0, 0, seed) * 1.8 - 0.9, angle = hash(i, 1, 0, seed) * Math.PI * 2
    const normal = new THREE.Vector3(Math.cos(angle) * Math.sqrt(1 - y * y), y, Math.sin(angle) * Math.sqrt(1 - y * y))
    const size = hash(i, 2, 0, seed)
    const span = lunar ? 0.035 + size * 0.15 : i === 0 ? 0.31 + size * 0.07 : 0.05 + size ** 1.4 * 0.26
    if (craters.some(crater => crater.normal.angleTo(normal) < crater.span + span + 0.035)) continue
    craters.push({ normal, span, depth: radius * (lunar ? 0.006 + span * 0.1 : 0.01 + span * 0.14) })
  }
  const positions = geometry.attributes.position
  const colors = new Float32Array(positions.count * 3)
  for (let i = 0; i < positions.count; i++) {
    point.fromBufferAttribute(positions, i).normalize()
    let height = 0, tint = 1
    for (const crater of craters) {
      const d = point.angleTo(crater.normal) / crater.span
      if (d >= 1.15) continue
      const bowl = -crater.depth * Math.max(0, 1 - (d / 0.79) ** 2) ** 2
      const rim = crater.depth * 0.46 * Math.exp(-(((d - 0.81) / 0.14) ** 2))
      height += bowl + rim
      tint += (bowl * 0.48 + rim * 0.45) / crater.depth
    }
    point.multiplyScalar(radius + height)
    positions.setXYZ(i, point.x, point.y, point.z)
    colors.fill(tint, i * 3, i * 3 + 3)
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  geometry.userData.craters = craters
  return geometry
}

// Object-space noise stays attached to the rotating globe and has no UV seam.
const planetNoise = `
  float planetHash(vec3 p) {
    p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }
  float planetNoise(vec3 p) {
    vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(planetHash(i), planetHash(i + vec3(1,0,0)), f.x),
                   mix(planetHash(i + vec3(0,1,0)), planetHash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(planetHash(i + vec3(0,0,1)), planetHash(i + vec3(1,0,1)), f.x),
                   mix(planetHash(i + vec3(0,1,1)), planetHash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float planetFbm(vec3 p) {
    return planetNoise(p) * 0.57 + planetNoise(p * 2.03) * 0.28 + planetNoise(p * 4.07) * 0.15;
  }
`

export function makePlanetSurfaceMaterial(texture, seed, style) {
  const material = new THREE.MeshStandardMaterial({
    map: texture, bumpMap: texture, bumpScale: style.bands ? 0.015 : 0.065,
    vertexColors: !style.bands && style.craters !== false,
    roughness: style.surface === 'ice' ? 0.42 : 0.94, emissive: 0xffffff, emissiveMap: texture, emissiveIntensity: 0.025, fog: false,
  })
  const detail = { value: 0 }, hueShift = { value: 0 }
  material.userData.detail = detail
  material.userData.hueShift = hueShift
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, {
      orbitDetail: detail, surfaceSeed: { value: seed }, banded: { value: style.bands ? 1 : 0 },
      fractured: { value: style.cracked ? 1 : 0 }, surfaceHue: hueShift,
    })
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPlanetNormal; varying vec3 vPlanetPoint;')
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        vPlanetNormal = normalize(mat3(modelMatrix) * objectNormal);
        vPlanetPoint = position;`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vPlanetNormal; varying vec3 vPlanetPoint;
        uniform float orbitDetail, surfaceSeed, banded, fractured, surfaceHue;
        vec3 shiftSurfaceHue(vec3 color) {
          vec3 axis = normalize(vec3(1.0));
          float c = cos(surfaceHue), s = sin(surfaceHue);
          return max(vec3(0.0), color * c + cross(axis, color) * s + axis * dot(axis, color) * (1.0 - c));
        }
        ${planetNoise}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec3 surfacePoint = normalize(vPlanetPoint);
        float turbulence = planetFbm(surfacePoint * 18.0 + surfaceSeed);
        float ridges = pow(1.0 - abs(planetFbm(surfacePoint * 65.0 + turbulence * 3.0) * 2.0 - 1.0), 3.0);
        float grain = planetNoise(surfacePoint * 240.0 + surfaceSeed);
        float bands = sin(surfacePoint.y * 260.0 + turbulence * 12.0) * 0.5 + 0.5;
        float fissure = 1.0 - smoothstep(0.025, 0.09, abs(turbulence - 0.5));
        float relief = mix(ridges * 0.7 + grain * 0.3 - fissure * fractured * 0.4, bands * 0.6 + turbulence * 0.4, banded);
        float surfaceTint = mix(1.0, 0.72 + relief * 0.55, orbitDetail);
        diffuseColor.rgb = shiftSurfaceHue(diffuseColor.rgb) * surfaceTint;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        float height = relief * orbitDetail * mix(0.045, 0.006, banded);
        normal = perturbNormalArb(-vViewPosition, normal, vec2(dFdx(height), dFdy(height)), faceDirection);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        #ifdef USE_COLOR
          totalEmissiveRadiance *= vColor.rgb;
        #endif
        float daylight = max(dot(normalize(vPlanetNormal), normalize(vec3(-35.0, 45.0, 25.0))), 0.0);
        totalEmissiveRadiance = shiftSurfaceHue(totalEmissiveRadiance) * surfaceTint * (mix(0.06, 0.14, orbitDetail) + 0.94 * daylight);`)
  }
  return material
}

export function makePlanetCloudMaterial(seed, color) {
  const material = new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: 0.09, transparent: true,
    opacity: 0, depthWrite: false, roughness: 1, fog: false,
  })
  material.onBeforeCompile = shader => {
    shader.uniforms.cloudSeed = { value: seed }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCloudPoint;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCloudPoint = position;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vCloudPoint; uniform float cloudSeed; ${planetNoise}`)
      .replace('#include <alphamap_fragment>', `#include <alphamap_fragment>
        vec3 p = normalize(vCloudPoint);
        float warp = planetFbm(p * 5.0 + cloudSeed);
        float cloud = planetFbm(p * vec3(9.0, 18.0, 9.0) + warp * 4.0 + cloudSeed);
        diffuseColor.a *= smoothstep(0.51, 0.72, cloud);`)
  }
  return material
}

export function makeParticleTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 32
  const context = canvas.getContext('2d')
  const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16)
  gradient.addColorStop(0, '#fff')
  gradient.addColorStop(0.2, '#ffffffef')
  gradient.addColorStop(0.5, '#ffffff55')
  gradient.addColorStop(1, '#ffffff00')
  context.fillStyle = gradient
  context.fillRect(0, 0, 32, 32)
  return new THREE.CanvasTexture(canvas)
}

export function makeRingTexture(seed, planetColor) {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 1
  const context = canvas.getContext('2d')
  const color = new THREE.Color(planetColor).offsetHSL(seed % 2 ? 0.025 : -0.025, 0.1, 0.08).convertLinearToSRGB()
  const rgb = [color.r, color.g, color.b].map(channel => Math.round(channel * 255)).join(',')
  for (let x = 0; x < 512; x += 1) {
    const t = x / 512
    const band = 0.8 + hash(x, 0, 0, seed) * 0.13 + Math.sin(t * 180) * 0.06
    const edge = Math.min(1, t * 28, (1 - t) * 18)
    const gap = t > 0.61 && t < 0.66 ? 0.06 : 1
    context.fillStyle = `rgba(${rgb},${band * edge * gap})`
    context.fillRect(x, 0, 1, 1)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export function makePlanetPortrait(renderer, planet, ring, viewpoint) {
  const size = 160
  const target = new THREE.WebGLRenderTarget(size, size)
  target.texture.colorSpace = THREE.SRGBColorSpace
  const scene = new THREE.Scene()
  const material = planet.material.clone()
  material.color.set(0xffffff)
  material.emissiveIntensity = 0.12
  const globe = new THREE.Mesh(planet.geometry, material)
  scene.add(globe, new THREE.HemisphereLight(0xc3d6eb, 0x182027, 0.65))
  const light = new THREE.DirectionalLight(0xffffff, 2.5)
  light.position.set(-35, 45, 25)
  scene.add(light)
  let ringMaterial
  if (ring) {
    ringMaterial = ring.material.clone()
    ringMaterial.opacity = 0.85
    const orbit = new THREE.Mesh(ring.geometry, ringMaterial)
    orbit.quaternion.copy(ring.quaternion)
    scene.add(orbit)
  }
  const radius = planet.geometry.parameters.radius
  const frame = radius * (ring ? 2.35 : 1.18)
  const camera = new THREE.OrthographicCamera(-frame, frame, frame, -frame, 0.1, 100)
  camera.position.copy(viewpoint).sub(planet.position).normalize().multiplyScalar(30)
  camera.lookAt(0, 0, 0)
  const previousTarget = renderer.getRenderTarget()
  const clearColor = renderer.getClearColor(new THREE.Color())
  const clearAlpha = renderer.getClearAlpha()
  renderer.setRenderTarget(target)
  renderer.setClearColor(0x000000, 0)
  renderer.render(scene, camera)
  const pixels = new Uint8Array(size * size * 4)
  renderer.readRenderTargetPixels(target, 0, 0, size, size, pixels)
  renderer.setRenderTarget(previousTarget)
  renderer.setClearColor(clearColor, clearAlpha)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const context = canvas.getContext('2d')
  const image = context.createImageData(size, size)
  for (let y = 0; y < size; y += 1) {
    image.data.set(pixels.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4)
  }
  context.putImageData(image, 0, 0)
  target.dispose()
  material.dispose()
  ringMaterial?.dispose()
  return canvas.toDataURL()
}

export function makeAtmosphereMaterial(color) {
  return new THREE.ShaderMaterial({
    uniforms: { tint: { value: new THREE.Color(color) }, opacity: { value: 0.35 } },
    vertexShader: `varying vec3 vNormal; varying vec3 vPosition;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vNormal = normalize(mat3(modelMatrix) * normal);
        vPosition = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: `uniform vec3 tint; uniform float opacity; varying vec3 vNormal; varying vec3 vPosition;
      void main() {
        float rim = pow(1.0 - max(dot(normalize(vNormal), normalize(cameraPosition - vPosition)), 0.0), 3.2);
        float light = 0.18 + 0.82 * max(dot(normalize(vNormal), normalize(vec3(-35.0, 45.0, 25.0))), 0.0);
        gl_FragColor = vec4(tint, rim * light * opacity);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
}

export function makeFlameMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, opacity: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec2 vUv; uniform float time; uniform float opacity;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + 1.), f.x), f.y);
      }
      void main() {
        float y = vUv.y;
        float n = noise(vec2(vUv.x * 5.0, y * 5.0 - time * 1.8));
        float drift = sin(y * 7.0 - time * 2.0) * y * 0.07 + (n - 0.5) * y * 0.18;
        float width = (1.0 - y) * 0.32;
        float body = 1.0 - smoothstep(width * 0.2, width + 0.05, abs(vUv.x - 0.5 + drift));
        float alpha = body * smoothstep(0.0, 0.1, y) * (1.0 - smoothstep(0.65 + n * 0.28, 1.0, y));
        vec3 color = mix(vec3(1.0, 0.19, 0.025), vec3(1.0, 0.83, 0.4), body * (1.0 - y));
        gl_FragColor = vec4(color, alpha * opacity);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  })
}
