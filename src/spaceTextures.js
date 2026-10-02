import { Texture } from 'three'
import { makeDirtTexture, makePlanetTexture } from './spaceMaterials.js'

// Keep the same procedural images, but build them away from touch/UI events.
export function createSpaceTextures() {
  const jobs = []
  let worker, disposed = false
  const fallback = job => {
    if (job.fallback) return
    job.fallback = true
    // Browsers without worker canvas support still yield between images.
    setTimeout(() => {
      if (!disposed) {
        job.texture.image = job.kind === 'dirt' ? makeDirtTexture(...job.args) : makePlanetTexture(...job.args)
        job.texture.needsUpdate = true
        job.done = true
      }
      job.resolve()
    }, 0)
  }
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      worker = new Worker(new URL('./spaceTexture.worker.js', import.meta.url), { type: 'module' })
      worker.onmessage = ({ data: { id, bitmap, failed } }) => {
        const job = jobs[id]
        if (disposed || job.done) { bitmap?.close(); return }
        if (failed) { fallback(job); return }
        job.texture.image = bitmap
        job.texture.needsUpdate = true
        job.done = true
        job.resolve()
      }
      worker.onerror = event => {
        event.preventDefault()
        worker?.terminate()
        worker = null
        jobs.filter(job => !job.done).forEach(fallback)
      }
    } catch {
      worker = null
    }
  }
  const create = (kind, args) => {
    const texture = new Texture()
    const job = { texture, kind, args }
    job.ready = new Promise(resolve => { job.resolve = resolve })
    const id = jobs.push(job) - 1
    if (worker) worker.postMessage({ id, kind, args })
    else fallback(job)
    return texture
  }
  return {
    dirt: (...args) => create('dirt', args),
    planet: (...args) => create('planet', args),
    async ready() {
      await Promise.all(jobs.map(job => job.ready))
      worker?.terminate()
      worker = null
    },
    dispose() {
      disposed = true
      worker?.terminate()
      jobs.forEach(job => { job.texture.image?.close?.(); job.resolve() })
    },
  }
}
