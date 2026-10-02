// Run: node scripts/check-space-companions.mjs
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { rollPlanetCompanions, rollSystemCompanions, rollMoonSurface, companionOpacity, createPlanetCompanions } from '../src/spaceCompanions.js'
import { makePlanetGeometry, makeRingTexture, skyElevationBrightness } from '../src/spaceMaterials.js'

assert.equal(skyElevationBrightness(0), 0.2, 'The horizon should be 20% as bright')
assert.equal(skyElevationBrightness(-1), 0.2)
assert.equal(skyElevationBrightness(1), 1, 'The zenith should retain full brightness')
let previousSkyBrightness = 0.2
for (let elevation = 0; elevation <= 1; elevation += 0.01) {
  const brightness = skyElevationBrightness(elevation)
  assert.ok(brightness >= previousSkyBrightness && brightness <= 1)
  previousSkyBrightness = brightness
}

for (const bands of [false, true]) {
  const geometry = makePlanetGeometry(3, 12, { bands })
  const positions = geometry.attributes.position, point = new THREE.Vector3()
  const radii = Array.from({ length: positions.count }, (_, i) => point.fromBufferAttribute(positions, i).length())
  if (bands) {
    assert.equal(geometry.userData.craters, undefined, 'Gas giants must not have craters')
    assert.ok(radii.every(radius => Math.abs(radius - 3) < 1e-6))
  } else {
    const craters = geometry.userData.craters
    assert.ok(craters.length >= 16, 'Rocky planets need more frequent craters')
    const spans = craters.map(crater => crater.span)
    assert.ok(Math.max(...spans) > 0.3 && Math.max(...spans) / Math.min(...spans) > 3, 'Rocky planets need large impact basins alongside small craters')
    assert.ok(Math.min(...radii) < 2.96 && Math.max(...radii) > 3.01, 'Rocky craters need recessed bowls and raised rims')
  }
  geometry.dispose()
}

let seed = 7823
const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296)
const surfaces = { lunar: 0, sulfur: 0, rainbow: 0, null: 0 }
for (let i = 0; i < 50000; i++) surfaces[rollMoonSurface(random)]++
for (const [surface, probability] of Object.entries({ lunar: 0.125, sulfur: 0.125, rainbow: 0.5, null: 0.25 })) {
  assert.ok(Math.abs(surfaces[surface] / 50000 - probability) < 0.008, `${surface} moon probability`)
}
for (const [roll, surface] of [[0, 'lunar'], [0.12499, 'lunar'], [0.125, 'sulfur'], [0.24999, 'sulfur'], [0.25, 'rainbow'], [0.74999, 'rainbow'], [0.75, null], [0.99999, null]]) {
  assert.equal(rollMoonSurface(() => roll), surface)
}
const counts = [0, 0, 0, 0], ufos = [0, 0, 0, 0]
for (let i = 0; i < 50000; i++) {
  const config = rollPlanetCompanions(random)
  counts[config.moonCount]++
  ufos[config.moonCount] += Number(config.ufo)
}
for (const [i, probability] of [0.35, 0.35, 0.2, 0.1].entries()) {
  assert.ok(Math.abs(counts[i] / 50000 - probability) < 0.012)
  assert.ok(Math.abs(ufos[i] / counts[i] - 0.1) < 0.015, 'UFO chance must be independent of moon count')
}
for (const [roll, expected] of [[0, 1], [0.3499, 1], [0.35, 2], [0.5499, 2], [0.55, 3], [0.6499, 3], [0.65, 0], [0.9999, 0]]) {
  const rolls = [roll, 0.1]
  assert.deepEqual(rollPlanetCompanions(() => rolls.shift()), { moonCount: expected, ufo: false })
}
const hosts = Array(8).fill(0), fleetSizes = new Set()
for (let i = 0; i < 10000; i++) {
  const configs = rollSystemCompanions(8, random)
  const count = configs.filter(config => config.ufo).length
  assert.ok(count >= 1 && count <= 2, 'Each system must have one or two UFOs')
  fleetSizes.add(count)
  configs.forEach((config, index) => { hosts[index] += Number(config.ufo) })
}
assert.deepEqual([...fleetSizes].sort(), [1, 2])
assert.ok(Math.max(...hosts) / Math.min(...hosts) < 1.15, 'UFO hosts must not favor early planets')
for (const [roll, expected] of [[0.9, 1], [0, 2]]) {
  assert.equal(rollSystemCompanions(8, () => roll).filter(config => config.ufo).length, expected)
}
assert.deepEqual(rollSystemCompanions(0), [])
let previousOpacity = 0
for (let distance = 160; distance >= 40; distance--) {
  const opacity = companionOpacity(distance, 40)
  assert.ok(opacity >= previousOpacity && opacity <= 1, 'Companions must fade in monotonically on approach')
  assert.ok(opacity - previousOpacity < 0.025, 'The approach fade must not pop')
  previousOpacity = opacity
}
assert.equal(companionOpacity(45, 40), 1, 'Companions must be fully visible before arrival')
assert.equal(companionOpacity(160, 40), 0)
// Canvas pixels are generated normally; only GPU upload is omitted in this Node check.
globalThis.document = { createElement: () => {
  const canvas = { bands: [] }
  canvas.getContext = () => ({
    createImageData: (width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }),
    putImageData(image) { canvas.pixels = image.data },
    fillRect() { canvas.bands.push(this.fillStyle) },
  })
  return canvas
} }
const particleTexture = new THREE.Texture()
for (const [roll, surface] of [[0.1, 'lunar'], [0.2, 'sulfur'], [0.275, 'rainbow']]) {
  let creating = true
  const system = createPlanetCompanions({ radius: 3, planetStyle: {} }, particleTexture, { moonCount: 1, ufo: false }, () => creating ? roll : random())
  creating = false
  const moon = system.moons[0], material = moon.mesh.material
  assert.equal(moon.surface, surface)
  const maxMoonRadius = 3 * 0.335
  if (surface === 'rainbow') {
    assert.ok(moon.radius >= maxMoonRadius * 0.6 && moon.radius <= maxMoonRadius, 'Rainbow moons must be between 60% and 100% of maximum moon size')
    assert.equal(moon.mesh.geometry.parameters.radius, moon.radius, 'The size floor must apply to the rendered surface')
  } else assert.ok(moon.radius < maxMoonRadius * 0.6, 'Small non-rainbow moons keep their original sizes')
  if (surface === 'lunar') assert.ok(moon.mesh.geometry.userData.craters.length >= 20, 'Lunar moons need dense crater relief')
  assert.equal(material.map.image.width, 512, 'Detailed moons need high resolution textures')
  const version = material.map.version
  system.update(1, 1, false)
  const colorTime = material.userData.rainbowTime.value
  const sparkleColors = moon.sparkles?.geometry.attributes.color.array.slice()
  const sparklePositions = moon.sparkles?.geometry.attributes.position.array.slice()
  const glowTint = moon.glow?.material.uniforms.tint.value.clone()
  assert.equal(colorTime > 0, surface === 'rainbow', 'Only rainbow moons animate surface colors')
  system.update(10, 1, true)
  assert.equal(material.userData.rainbowTime.value, colorTime, 'Reduced motion freezes rainbow colors')
  if (moon.sparkles) {
    assert.deepEqual(moon.sparkles.geometry.attributes.color.array, sparkleColors, 'Reduced motion freezes twinkling')
    assert.deepEqual(moon.sparkles.geometry.attributes.position.array, sparklePositions, 'Reduced motion freezes sparkle locations')
    assert.ok(moon.glow.material.uniforms.tint.value.equals(glowTint), 'Reduced motion freezes the glow color')
  }
  system.update(1, 1, false)
  if (surface === 'rainbow') {
    assert.equal(material.userData.rainbowTime.value, 2, 'Color pulses advance with active animation time')
    assert.equal(material.emissiveIntensity, 1.632, 'Rainbow glow includes the additional 15% reduction')
    assert.equal(material.color.r, 1.4)
    assert.notDeepEqual(moon.sparkles.geometry.attributes.color.array, sparkleColors, 'Surface glints should shimmer')
    const { position: positions, color: colors } = moon.sparkles.geometry.attributes
    const point = new THREE.Vector3()
    let moves = 0, peak = 0
    for (let frame = 0; frame < 120; frame++) {
      const previous = positions.array.slice()
      system.update(1 / 30, 1, false)
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions, i)
        assert.ok(Math.abs(point.length() - moon.radius * 1.005) < 1e-6, 'Sparkles stay on the surface')
        const alpha = colors.getW(i)
        assert.ok(alpha >= 0 && alpha <= 1)
        peak = Math.max(peak, alpha)
        if (!point.equals(new THREE.Vector3().fromArray(previous, i * 3))) {
          moves++
          assert.equal(alpha, 0, 'Sparkles relocate only when fully faded out')
        }
      }
    }
    assert.ok(moves > positions.count && peak > 0.9, 'Sparkles must flash and repeatedly choose fresh locations')
    system.update(0, 0.5, false)
    assert.equal(moon.sparkles.material.opacity, moon.sparkles.material.userData.baseOpacity * 0.5, 'Sparkles fade with the moon')
    assert.equal(moon.glow.material.uniforms.opacity.value, moon.glow.material.userData.baseOpacity * 0.5, 'Glow fades with the moon')
    assert.equal(moon.halo.material.opacity, moon.halo.material.userData.baseOpacity * 0.5, 'Soft halo fades with the moon')
    moon.sparkles.geometry.dispose(); moon.sparkles.material.dispose()
    moon.glow.geometry.dispose(); moon.glow.material.dispose()
    moon.halo.material.dispose()
  } else {
    assert.equal(moon.sparkles, null)
    assert.equal(moon.glow, null)
    assert.equal(moon.halo, null)
  }
  assert.equal(material.map.version, version, 'Color shifts must not regenerate or upload textures')
  moon.mesh.geometry.dispose(); material.map.dispose(); material.dispose()
}
const blueRing = makeRingTexture(2, '#285488'), redRing = makeRingTexture(2, '#c84a51')
assert.notEqual(blueRing.image.bands[100], redRing.image.bands[100], 'Rings inherit their own planet color')
const ringBand = color => color.match(/[\d.]+/g).map(Number)
assert.ok(ringBand(blueRing.image.bands[100])[2] > ringBand(blueRing.image.bands[100])[0])
assert.ok(ringBand(redRing.image.bands[100])[0] > ringBand(redRing.image.bands[100])[2])
assert.ok(ringBand(blueRing.image.bands[100])[3] > 0.75, 'Tinting rings must preserve their opacity')
blueRing.dispose(); redRing.dispose()
for (const roll of [0.8, 0.1]) {
  const rolls = [roll, 0.9]
  const system = createPlanetCompanions({ radius: 3, planetStyle: {} }, particleTexture, rollPlanetCompanions(() => rolls.shift()), random)
  system.update(1, 1, false)
  assert.equal(system.config.ufo, false)
  assert.equal(system.group.getObjectByName('ufo'), undefined)
  assert.equal(system.group.getObjectByName('ufo-trail'), undefined)
  assert.equal(system.group.visible, roll === 0.1)
  if (roll === 0.8) assert.equal(system.outerRadius, 3 * 1.1, 'Empty systems keep the original camera framing')
}
const orbitalSpeeds = []
for (const rings of [false, true]) {
  for (const [count, roll] of [0.8, 0.1, 0.45, 0.6].entries()) {
    const rolls = [roll, 0.01]
    const system = createPlanetCompanions({ radius: 3, planetStyle: { rings } }, particleTexture, rollPlanetCompanions(() => rolls.shift()), random)
    assert.equal(system.config.moonCount, count)
    assert.equal(system.group.visible, false)
    orbitalSpeeds.push(...system.moons.map(moon => moon.speed))
    if (count === 3) {
      const radii = system.moons.map(moon => moon.radius)
      assert.ok(Math.max(...radii) / Math.min(...radii) > 1.3, 'Moon sizes should still vary with the rainbow minimum')
      const ice = system.moons.find(moon => moon.surface === 'ice')
      if (ice) assert.equal(ice.mesh.geometry.userData.craters, undefined)
    }
    const clearance = 3 * (rings ? 2.25 : 1.15), visited = new Set()
    const previous = new THREE.Vector3()
    for (let frame = 0; frame < 1500; frame++) {
      system.update(1 / 30, 1, false)
      if (frame) assert.ok(system.craft.position.distanceTo(previous) < 1.5, `UFO transfers must remain continuous (${rings}, ${count}, frame ${frame}, step ${system.craft.position.distanceTo(previous)})`)
      previous.copy(system.craft.position)
      assert.ok(system.craft.position.length() >= clearance + 3 * 0.13 - 1e-5, `UFO must clear planet and rings (${rings}, ${count}, frame ${frame}, distance ${system.craft.position.length()})`)
      assert.ok(system.craft.position.length() + 3 * 0.13 <= system.outerRadius, 'Camera framing must include UFO')
      system.moons.forEach((moon, i) => {
        const distance = system.craft.position.distanceTo(moon.mesh.position)
        assert.ok(distance >= moon.radius + 3 * 0.13 - 1e-5, 'UFO must clear every moon')
        if (distance < moon.radius + 3 * 0.45) visited.add(i)
        assert.ok(moon.mesh.position.length() - moon.radius > clearance, 'Moons must clear the planet and rings')
        assert.ok(moon.mesh.position.length() + moon.radius <= system.outerRadius)
        system.moons.slice(i + 1).forEach(other => assert.ok(moon.mesh.position.distanceTo(other.mesh.position) > moon.radius + other.radius, 'Moons must not collide'))
      })
      assert.ok(system.craft.position.toArray().every(Number.isFinite))
    }
    assert.equal(visited.size, count, 'The route must visit each moon')
    const trail = system.group.getObjectByName('ufo-trail')
    const colors = trail.geometry.attributes.color
    assert.ok(colors.getX(0) > 0 && colors.getX(colors.count - 1) === 0, 'The trail must fade fully at its oldest end')
    const head = new THREE.Vector3().fromBufferAttribute(trail.geometry.attributes.position, 0)
    assert.ok(head.distanceTo(system.craft.position) < 1e-5, 'Trail must start at the craft')
    const position = system.craft.position.clone(), moonPositions = system.moons.map(m => m.mesh.position.clone())
    system.update(1, 1, true)
    assert.ok(system.craft.position.equals(position))
    assert.equal(trail.visible, false, 'Reduced motion suppresses the trail')
    assert.ok(system.moons.every((m, i) => m.mesh.position.equals(moonPositions[i])))
    system.update(0, 0, false)
    assert.equal(system.group.visible, false, 'No companions outside inspection')
    system.update(0, 1, false)
    assert.ok(system.craft.position.equals(position), 'Revisiting must preserve the same system')
    system.update(1 / 30, 0, false)
    assert.ok(!system.craft.position.equals(position), 'Distant systems keep animating during inspection')
    for (const opacity of [0.25, 0.65, 1, 0.65, 0.25, 0]) {
      system.update(0, opacity, false)
      system.group.traverse(object => {
        if (object.material) assert.equal(object.material.opacity, object.material.userData.baseOpacity * opacity, 'Moons, craft and trail must share the distance fade without arrival lag')
      })
    }
    system.group.traverse(object => {
      object.geometry?.dispose()
      object.material?.dispose()
      if (object.material?.map !== particleTexture) object.material?.map?.dispose()
    })
  }
}
assert.ok(Math.max(...orbitalSpeeds) / Math.min(...orbitalSpeeds) > 4, 'Moon speeds need a wide range from leisurely to quick')
particleTexture.dispose()
console.log('PASS: moon probabilities and variation, rocky-only craters, one or two UFOs per system, ring/moon clearance, moon visits, camera bounds, distance fades, continuous distant animation, fading trail, stable revisits and reduced motion.')
