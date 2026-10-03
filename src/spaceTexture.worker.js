import { makeDirtTexture, makePlanetTexture } from './spaceMaterials.js'

self.onmessage = async ({ data: { id, kind, args } }) => {
  try {
    const canvas = kind === 'dirt' ? makeDirtTexture(...args) : makePlanetTexture(...args)
    // ImageBitmap uploads ignore Texture.flipY, so match CanvasTexture here.
    const bitmap = await createImageBitmap(canvas, { imageOrientation: 'flipY', premultiplyAlpha: 'none' })
    self.postMessage({ id, bitmap }, [bitmap])
  } catch {
    self.postMessage({ id, failed: true })
  }
}
