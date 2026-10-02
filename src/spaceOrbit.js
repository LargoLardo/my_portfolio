import * as THREE from 'three'

const UP = new THREE.Vector3(0, 1, 0)

export function createPlanetOrbit(camera, onPhaseChange) {
  let phase = 'ground'
  let target = null
  let age = 0
  let azimuth = 0, elevation = 0, viewAzimuth = 0, viewElevation = 0, distance = 12
  const homePosition = new THREE.Vector3()
  const homeRotation = new THREE.Quaternion()
  const startRotation = new THREE.Quaternion()
  const lookRotation = new THREE.Quaternion()
  const lookMatrix = new THREE.Matrix4()
  const direction = new THREE.Vector3()
  const offset = new THREE.Vector3()
  const endPosition = new THREE.Vector3()
  const path = new THREE.CubicBezierCurve3()

  const setPhase = value => {
    if (phase === value) return
    phase = value
    onPhaseChange(value)
  }
  const orbitPosition = () => {
    offset.set(Math.sin(viewAzimuth) * Math.cos(viewElevation), Math.sin(viewElevation), Math.cos(viewAzimuth) * Math.cos(viewElevation))
    return endPosition.copy(target.position).addScaledVector(offset, distance)
  }

  return {
    get active() { return phase !== 'ground' },
    get phase() { return phase },
    get target() { return target },
    get distanceFromCamp() { return camera.position.distanceTo(homePosition) },
    drag(dx, dy) {
      if (phase !== 'orbit') return
      azimuth -= dx * 0.004
      elevation = THREE.MathUtils.clamp(elevation + dy * 0.003, -0.75, 0.75)
    },
    update(nextTarget, desiredDistance, dt, reducedMotion) {
      if (nextTarget !== target) {
        if (phase === 'ground') {
          homePosition.copy(camera.position)
          homeRotation.copy(camera.quaternion)
        }
        const previousTarget = target
        target = nextTarget
        path.v0.copy(camera.position)
        startRotation.copy(camera.quaternion)
        age = 0
        if (target) {
          direction.subVectors(camera.position, target.position).normalize()
          azimuth = viewAzimuth = Math.atan2(direction.x, direction.z)
          elevation = viewElevation = THREE.MathUtils.clamp(Math.asin(direction.y), -0.65, 0.65)
          distance = desiredDistance
          path.v3.copy(orbitPosition())
          setPhase('approach')
        } else {
          path.v3.copy(homePosition)
          setPhase('returning')
        }
        const travel = path.v0.distanceTo(path.v3)
        // Depart away from the old surface, then approach the new world's near side.
        direction.copy(previousTarget ? path.v0.clone().sub(previousTarget.position).normalize() : UP)
        path.v1.copy(path.v0).addScaledVector(direction, Math.max(5, travel * 0.2))
        direction.copy(target ? path.v3.clone().sub(target.position).normalize() : UP)
        path.v2.copy(path.v3).addScaledVector(direction, Math.max(5, travel * 0.2))
      }
      if (phase === 'ground') return
      distance = THREE.MathUtils.damp(distance, desiredDistance, 5, dt)
      if (phase === 'approach' || phase === 'returning') {
        age += dt
        const t = reducedMotion ? 1 : Math.min(1, age / 2.4)
        const eased = t * t * (3 - 2 * t)
        if (target) path.v3.copy(orbitPosition())
        path.getPoint(eased, camera.position)
        if (target) lookRotation.setFromRotationMatrix(lookMatrix.lookAt(camera.position, target.position, UP))
        else lookRotation.copy(homeRotation)
        camera.quaternion.slerpQuaternions(startRotation, lookRotation, eased)
        if (t === 1) setPhase(target ? 'orbit' : 'ground')
      } else {
        if (!reducedMotion) azimuth += dt * 0.045
        const ease = reducedMotion ? 1 : 1 - Math.exp(-dt * 10)
        viewAzimuth = THREE.MathUtils.lerp(viewAzimuth, azimuth, ease)
        viewElevation = THREE.MathUtils.lerp(viewElevation, elevation, ease)
        camera.position.copy(orbitPosition())
        camera.lookAt(target.position)
      }
    },
  }
}
