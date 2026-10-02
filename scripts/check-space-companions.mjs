// Run: node scripts/check-space-companions.mjs
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { rollPlanetCompanions, createPlanetCompanions } from '../src/spaceCompanions.js'
import { makePlanetGeometry } from '../src/spaceMaterials.js'

for (const bands of [false, true]) {
  const geometry = makePlanetGeometry(3, 12, { bands })
  const positions = geometry.attributes.position, point = new THREE.Vector3()
  const radii = Array.from({ length: positions.count }, (_, i) => point.fromBufferAttribute(positions, i).length())
  if (bands) {
    assert.equal(geometry.userData.craters, undefined, 'Gas giants must not have craters')
    assert.ok(radii.every(radius => Math.abs(radius - 3) < 1e-6))
  } else {
    assert.ok(geometry.userData.craters.length > 0)
    assert.ok(Math.min(...radii) < 2.96 && Math.max(...radii) > 3.01, 'Rocky craters need recessed bowls and raised rims')
  }
  geometry.dispose()
}

let seed = 7823
const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296)
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
// Canvas pixels are generated normally; only GPU upload is omitted in this Node check.
globalThis.document = { createElement: () => ({ getContext: () => ({
  createImageData: (width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }),
  putImageData() {},
}) }) }
const particleTexture = new THREE.Texture()
for (const roll of [0.8, 0.1]) {
  const rolls = [roll, 0.9]
  const system = createPlanetCompanions({ radius: 3, planetStyle: {} }, particleTexture, () => rolls.shift() ?? random())
  system.update(1, true, false)
  assert.equal(system.config.ufo, false)
  assert.equal(system.group.getObjectByName('ufo'), undefined)
  assert.equal(system.group.getObjectByName('ufo-trail'), undefined)
  assert.equal(system.group.visible, roll === 0.1)
  if (roll === 0.8) assert.equal(system.outerRadius, 3 * 1.1, 'Empty systems keep the original camera framing')
}
for (const rings of [false, true]) {
  for (const [count, roll] of [0.8, 0.1, 0.45, 0.6].entries()) {
    const rolls = [roll, 0.01]
    const system = createPlanetCompanions({ radius: 3, planetStyle: { rings } }, particleTexture, () => rolls.shift() ?? random())
    assert.equal(system.config.moonCount, count)
    assert.equal(system.group.visible, false)
    if (count === 3) {
      assert.equal(new Set(system.moons.map(moon => moon.surface)).size, 3, 'Moons should have distinct surface textures')
      const radii = system.moons.map(moon => moon.radius)
      assert.ok(Math.max(...radii) / Math.min(...radii) > 1.8, 'Moon sizes should vary visibly')
      assert.ok(system.moons[0].speed > system.moons[2].speed, 'Outer moons should orbit more slowly')
      const ice = system.moons.find(moon => moon.surface === 'ice')
      assert.equal(ice.mesh.geometry.userData.craters, undefined)
    }
    const clearance = 3 * (rings ? 2.25 : 1.15), visited = new Set()
    const previous = new THREE.Vector3()
    for (let frame = 0; frame < 1500; frame++) {
      system.update(1 / 30, true, false)
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
    system.update(1, true, true)
    assert.ok(system.craft.position.equals(position))
    assert.equal(trail.visible, false, 'Reduced motion suppresses the trail')
    assert.ok(system.moons.every((m, i) => m.mesh.position.equals(moonPositions[i])))
    system.update(1, false, false)
    assert.equal(system.group.visible, false, 'No companions outside inspection')
    system.update(0, true, false)
    assert.ok(system.craft.position.equals(position), 'Revisiting must preserve the same system')
    system.group.traverse(object => {
      object.geometry?.dispose()
      object.material?.dispose()
      if (object.material?.map !== particleTexture) object.material?.map?.dispose()
    })
  }
}
particleTexture.dispose()
console.log('PASS: exact moon probabilities, independent UFO roll, ring/moon clearance, moon visits, camera bounds, fading trail, inspection visibility, stable revisits and reduced motion.')
