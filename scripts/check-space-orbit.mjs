// Run: node scripts/check-space-orbit.mjs
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { createPlanetOrbit } from '../src/spaceOrbit.js'

const camera = new THREE.PerspectiveCamera()
camera.position.set(0, 1.54, 4.15)
camera.rotation.set(-0.1, 0.35, 0)
const home = camera.position.clone(), rotation = camera.quaternion.clone()
const phases = []
const planets = [[-31, 23, -75], [36, 25, -72], [-74, 44, -12], [4, 66, -78], [65, 30, 42]].map(position => {
  const mesh = new THREE.Object3D()
  mesh.position.set(...position).multiplyScalar(1.65)
  mesh.userData.orbitRadius = 7
  return mesh
})
const orbit = createPlanetOrbit(camera, phase => phases.push(phase), planets)
const step = (planet, seconds, distance = 15, reduced = false) => {
  for (let t = 0; t < seconds; t += 1 / 60) {
    orbit.update(planet, distance, 1 / 60, reduced)
    for (const body of planets) assert.ok(camera.position.distanceTo(body.position) > 7, 'Flight must stay clear of planet surfaces and rings')
    assert.ok(camera.position.y >= 1.54, 'Flight must stay above the campsite')
  }
}
for (const planet of planets) {
  step(planet, 59 / 60)
  assert.equal(orbit.phase, 'approach', 'Flight should still be moving just before one second')
  step(planet, 1 / 60)
  assert.equal(orbit.phase, 'orbit', 'Every destination should be reached in one second')
  assert.ok(Math.abs(camera.position.distanceTo(planet.position) - 15) < 1e-6)
  const from = camera.position.clone()
  step(planet, 1)
  assert.ok(camera.position.distanceTo(from) > 0.4, 'Orbit should keep moving')
  assert.ok(camera.getWorldDirection(new THREE.Vector3()).dot(planet.position.clone().sub(camera.position).normalize()) > 0.99999)
  orbit.drag(120, -60)
  step(planet, 1)
}
step(null, 59 / 60)
assert.equal(orbit.phase, 'returning')
step(null, 1 / 60)
assert.equal(orbit.phase, 'ground', 'The campsite should be reached in one second')
assert.ok(camera.position.distanceTo(home) < 1e-8)
assert.ok(camera.quaternion.angleTo(rotation) < 1e-7)
step(planets[0], 0.8)
step(null, 0.4)
step(planets[1], 0.5)
step(planets[2], 3)
step(null, 3)
assert.ok(camera.position.distanceTo(home) < 1e-8, 'Interrupted trips must preserve the original home')
step(planets[0], 0.02, 15, true)
assert.equal(orbit.phase, 'orbit')
const still = camera.position.clone()
step(planets[0], 2, 15, true)
assert.ok(camera.position.distanceTo(still) < 1e-8, 'Reduced motion disables automatic orbit')
step(null, 0.02, 15, true)
assert.equal(orbit.phase, 'ground')
assert.ok(camera.position.distanceTo(home) < 1e-8)
// Return from every side of a world; a straight homeward flight crosses it.
for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
  step(planets[0], 0.02, 15, true)
  orbit.drag(-angle / 0.004, 0)
  step(planets[0], 0.02, 15, true)
  step(null, 3)
}
assert.ok(phases.includes('approach') && phases.includes('returning'))
console.log('PASS: safe flight, orbit, drag, planet transfers, interruption, exact return from every side, reduced motion.')
