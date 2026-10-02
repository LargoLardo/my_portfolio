// With the dev server running, open /current in a disposable Chrome launched with
// --remote-debugging-port=9224 --user-data-dir=/tmp/portfolio-browser-check
// Run: node scripts/check-space-browser.mjs [Chrome debugging URL]
import assert from 'node:assert/strict'

const tabs = await (await fetch(`${process.argv[2] ?? 'http://127.0.0.1:9224'}/json`)).json()
const tab = tabs.find(page => new URL(page.url).pathname === '/current')
assert.ok(tab, 'Open the space page at /current first')
const socket = new WebSocket(tab.webSocketDebuggerUrl)
await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }))
let serial = 0
const pending = new Map()
const errors = []
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data)
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails)
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message.params.args)
  if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') errors.push(message.params.entry.text)
  if (!message.id) return
  const request = pending.get(message.id)
  pending.delete(message.id)
  message.error ? request.reject(message.error) : request.resolve(message.result)
})
const send = (method, params = {}) => new Promise((resolve, reject) => {
  pending.set(++serial, { resolve, reject })
  socket.send(JSON.stringify({ id: serial, method, params }))
})
const evaluate = async expression => (await send('Runtime.evaluate', { expression, returnByValue: true })).result.value
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
const waitFor = async expression => {
  for (let i = 0; i < 80; i++) {
    if (await evaluate(expression)) return
    await pause(100)
  }
  assert.fail(`Timed out: ${expression}`)
}
const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`)
const progress = () => evaluate("1 - Number(document.querySelector('.scope-progress').style.strokeDashoffset)")
const gap = () => evaluate("parseFloat(document.querySelector('.scope-signal').style.getPropertyValue('--signal-gap'))")
const mouse = (type, x, y, button = 'right', buttons = 2) => send('Input.dispatchMouseEvent', { type, x, y, button, buttons, clickCount: 1 })
let audioProbeId
try {
  await send('Runtime.enable')
  await send('Log.enable')
  await send('Page.enable')
  const probe = await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__spaceAudio = [];
    window.__spaceGraphics = { scenes: [], renderer: null };
    window.__THREE_DEVTOOLS__ = new EventTarget();
    window.__THREE_DEVTOOLS__.addEventListener('observe', ({ detail }) => {
      if (detail.isScene) window.__spaceGraphics.scenes.push(detail);
      if (detail.isWebGLRenderer) window.__spaceGraphics.renderer = detail;
    });
    window.Audio = new Proxy(window.Audio, {
      construct(Target, args) {
        const audio = new Target(...args);
        window.__spaceAudio.push(audio);
        return audio;
      }
    });
  ` })
  audioProbeId = probe.identifier
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  const loaded = new Promise(resolve => {
    const onLoad = ({ data }) => {
      if (JSON.parse(data).method !== 'Page.loadEventFired') return
      socket.removeEventListener('message', onLoad)
      resolve()
    }
    socket.addEventListener('message', onLoad)
  })
  await send('Page.reload', { ignoreCache: true })
  await loaded
  await waitFor("document.querySelector('.space-app')?.classList.contains('is-lit')")
  await waitFor("document.querySelectorAll('.destination-portrait').length === 8 && [...document.querySelectorAll('.destination-portrait')].every(e => e.naturalWidth === 160)")
  assert.equal(await evaluate("new Set([...document.querySelectorAll('.destination-portrait')].map(e => e.src)).size"), 8)
  const companions = await evaluate(`(() => {
    const { scenes, renderer } = window.__spaceGraphics;
    const scene = scenes.findLast(scene => scene.children.some(group => group.children.some(p => p.userData.companions)));
    const planets = scene.children.flatMap(group => group.children).filter(p => p.userData.companions);
    const starFades = scene.children.filter(o => o.isPoints && o.geometry.attributes.color?.itemSize === 4).map(o => {
      const colors = o.geometry.attributes.color;
      const values = Array.from({ length: colors.count }, (_, i) => colors.getW(i));
      return [Math.min(...values), Math.max(...values)];
    });
    let prepared = true;
    planets.forEach(planet => planet.userData.companions.group.traverse(object => {
      if (object.material && !renderer.properties.get(object.material).currentProgram) prepared = false;
      if (object.material?.map && !renderer.properties.get(object.material.map).__webglTexture) prepared = false;
    }));
    return {
      count: planets.length, ufos: planets.filter(p => p.userData.companions.config.ufo).length,
      hidden: planets.every(p => !p.userData.companions.group.visible), prepared, starFades,
      planetBrightness: planets.map(p => p.material.userData.skyBrightness.value),
    };
  })()`)
  assert.equal(companions.count, 8)
  assert.ok(companions.ufos >= 1 && companions.ufos <= 2, 'The scene must contain one or two UFOs')
  assert.ok(companions.hidden, 'Companions must stay hidden at camp')
  assert.ok(companions.prepared, 'Every companion shader and texture must be ready before the first flight')
  assert.equal(companions.starFades.length, 2, 'Both star fields should have an elevation gradient')
  assert.ok(companions.starFades.every(([min, max]) => Math.abs(min - 0.6) < 1e-6 && max > 0.999))
  assert.ok(companions.planetBrightness.every(value => value >= 0.6 && value < 1), 'Ground-view planets share the sky brightness gradient')
  assert.equal(await evaluate("document.querySelectorAll('[data-discovered=true]').length"), 0)
  assert.equal(await evaluate("document.querySelector('.mute-button').closest('[inert]')"), null)
  assert.equal(await evaluate("document.querySelector('.mute-button').textContent.trim()"), '')
  assert.equal(await evaluate("document.querySelector('.mute-button').getAttribute('aria-label')"), 'Mute music')
  assert.equal(await evaluate("!!document.querySelector('.controls-hud')"), false)
  await click('.mute-button')
  assert.equal(await evaluate("document.querySelector('.mute-button').getAttribute('aria-pressed')"), 'true')
  await click('.mute-button')
  assert.equal(await evaluate("document.querySelector('.mute-button').getAttribute('aria-pressed')"), 'false')
  await mouse('mousePressed', 1000, 650)
  await pause(180)
  const farGap = await gap()
  assert.ok(farGap > 25, 'Signal halves should start widely separated')
  await mouse('mouseMoved', 850, 480)
  await pause(250)
  assert.ok(await gap() < farGap - 5, 'Halves should approach one another before the planet is centered')
  assert.equal(await evaluate("document.querySelectorAll('[data-discovered=true]').length"), 0)
  await mouse('mouseMoved', 729, 385)
  await waitFor("document.querySelector('.signal-readout strong')?.textContent === 'Wanderer'")
  const scanStarted = Date.now()
  assert.equal(await evaluate("document.querySelector('.scope-button').getAttribute('aria-pressed')"), 'true')
  assert.equal(await evaluate("document.querySelectorAll('[data-discovered=true]').length"), 0, 'A partial scan must not discover the planet')
  await waitFor("Number(document.querySelector('.scope-progress').style.strokeDashoffset) < 1")
  assert.equal(await gap(), 0, 'Halves should meet before their circle begins filling')
  const first = await progress()
  await pause(150)
  assert.ok(await progress() > first, 'Progress must advance while aiming')
  await waitFor("!!document.querySelector('.discovery-confirmation')")
  assert.equal(await evaluate("!!document.querySelector('.discovery-panel')"), true, 'Open the story immediately when the scan completes')
  assert.ok(Date.now() - scanStarted < 1400, 'Scanning and opening the story should take less than 1.4 seconds')
  assert.equal(await evaluate("document.querySelectorAll('[data-discovered=true]').length"), 1)
  await waitFor("document.querySelector('.discovery-panel h1')?.textContent === 'Logan Zhao'")
  await mouse('mouseReleased', 729, 385, 'right', 0)
  assert.equal(await evaluate("document.querySelector('.scope-button').getAttribute('aria-pressed')"), 'false')
  await waitFor("document.querySelector('.space-app').dataset.cameraMode === 'orbit'")
  assert.ok(await evaluate("document.querySelector('.analysis-connector path').getAttribute('d')?.startsWith('M')"), 'Analysis must be connected to the projected planet')
  await evaluate("document.querySelector('.scene-mount').focus()")
  await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'Space', key: ' ', windowsVirtualKeyCode: 32 })
  assert.equal(await evaluate("document.querySelector('.scope-button').getAttribute('aria-pressed')"), 'false', 'Orbit controls must not activate ground scanning')
  await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'Space', key: ' ', windowsVirtualKeyCode: 32 })
  await click('.panel-close')
  assert.ok(await evaluate("document.querySelector('.discovery-panel')?.classList.contains('is-closing')"), 'Keep the panel mounted for its exit animation')
  await pause(80)
  assert.ok(await evaluate("(()=>{const p=document.querySelector('.discovery-panel');const opacity=Number(getComputedStyle(p).opacity);return p.inert&&opacity>0&&opacity<1})()"), 'Closing should fade smoothly and disable interaction')
  await waitFor("!document.querySelector('.discovery-panel')")
  await waitFor("document.querySelector('.space-app').dataset.cameraMode === 'ground'")
  await evaluate("document.querySelector('.scene-mount').focus()")
  await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'Space', key: ' ', windowsVirtualKeyCode: 32 })
  await waitFor("document.querySelector('.space-app').dataset.cameraMode === 'approach'")
  assert.equal(await evaluate("document.activeElement.className"), 'panel-close', 'Discovery should move focus into the analysis panel')
  // A held scan key keeps repeating even after discovery focuses the close button.
  await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'Space', key: ' ', windowsVirtualKeyCode: 32, autoRepeat: true })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'Space', key: ' ', windowsVirtualKeyCode: 32 })
  assert.equal(await evaluate("document.querySelector('.discovery-panel')?.classList.contains('is-closing')"), false, 'Releasing the scan key must not activate the newly focused close button')
  await waitFor("document.querySelector('.space-app').dataset.cameraMode === 'orbit'")
  assert.equal(await evaluate("document.querySelector('.discovery-panel h1')?.textContent"), 'Logan Zhao', 'The discovery must stay open after releasing Space')
  // A separate, intentional Space press must still activate a focused button.
  await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'Space', key: ' ', windowsVirtualKeyCode: 32 })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'Space', key: ' ', windowsVirtualKeyCode: 32 })
  await waitFor("document.querySelector('.space-app').dataset.cameraMode === 'ground'")
  await click('.scope-button')
  await mouse('mousePressed', 729, 385, 'left', 1)
  await mouse('mouseMoved', 1029, 585, 'left', 1)
  await mouse('mouseReleased', 1029, 585, 'left', 0)
  await waitFor("document.querySelector('.signal-readout strong')?.textContent === 'NO LOCK'")
  await mouse('mousePressed', 1029, 585, 'left', 1)
  await mouse('mouseMoved', 729, 385, 'left', 1)
  await mouse('mouseReleased', 729, 385, 'left', 0)
  await waitFor("!!document.querySelector('.discovery-confirmation')")
  await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'Escape', key: 'Escape', windowsVirtualKeyCode: 27 })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'Escape', key: 'Escape', windowsVirtualKeyCode: 27 })
  await waitFor("document.querySelector('.space-app').dataset.cameraMode === 'ground'")
  assert.equal(await evaluate("!!document.querySelector('.discovery-panel')"), false, 'Escape must close the scan result without reopening it')
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.scene-mount')).outlineStyle"), 'none', 'Focusing the scene must not draw a border around the screen')
  await click('.sections-button')
  const titles = await evaluate("[...document.querySelectorAll('.section-list strong')].map(e => e.textContent)")
  for (let i = 0; i < titles.length; i++) {
    await evaluate(`document.querySelectorAll('.section-list button')[${i}].click()`)
    await waitFor('!!document.querySelector(".discovery-panel")')
    assert.equal(await evaluate("document.querySelector('.discovery-panel h1').textContent"), titles[i])
    assert.equal(await evaluate("document.querySelector('.section-sidebar').getAttribute('aria-hidden')"), 'false')
  }
  assert.ok(await evaluate("document.querySelector('.discovery-panel').getBoundingClientRect().right < document.querySelector('.section-sidebar').getBoundingClientRect().left"), 'Details and field log must fit side by side')
  await click('.panel-close')
  await pause(80)
  await evaluate("document.querySelector('.section-list button').click()")
  await pause(250)
  assert.equal(await evaluate("document.querySelector('.discovery-panel h1')?.textContent"), titles[0], 'Choosing another planet during closing should cancel the exit')
  await click('.sections-button')
  assert.ok(await evaluate("!!document.querySelector('.discovery-panel')"), 'Toggling the field log must preserve the selected details')
  await click('.sections-button')
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
  await pause(350)
  assert.ok(await evaluate("(()=>{const p=document.querySelector('.discovery-panel').getBoundingClientRect(),l=document.querySelector('.section-sidebar').getBoundingClientRect();return p.bottom<l.top&&p.left>=0&&l.right<=innerWidth})()"), 'Panels must stack without overlap on phones')
  assert.ok(await evaluate("document.querySelector('.discovery-panel').getBoundingClientRect().top > 300"), 'Keep a visible sky window above the mobile analysis')
  await waitFor("document.querySelector('.space-app').dataset.cameraMode === 'orbit'")
  assert.ok(await evaluate("document.querySelector('.section-list').clientHeight > 80"), 'Mobile log needs enough space to show destinations')
  await click('.scope-button')
  await waitFor("document.querySelector('.space-app').dataset.cameraMode === 'ground'")
  assert.equal(await evaluate('document.documentElement.scrollWidth'), 390)
  assert.equal(await evaluate("document.querySelectorAll('[data-discovered=true]').length"), 8)
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await waitFor("window.__spaceAudio.at(-1)?.paused === false")
  const campVolume = await evaluate("window.__spaceAudio.at(-1).volume")
  assert.ok(campVolume > 0.02, 'Music should be audible at camp')
  await evaluate("document.querySelector('.section-list button').click()")
  await waitFor("document.querySelector('.space-app').dataset.cameraMode === 'orbit'")
  await pause(1200)
  assert.ok(Math.abs(await evaluate("window.__spaceAudio.at(-1).volume") - campVolume) < 0.005, 'Exploring a planet must preserve the camp listening volume')
  assert.equal(await evaluate("!!document.querySelector('.planet-analysis')"), false)
  await waitFor("Number(document.querySelector('.analysis-connector').style.opacity) > 0.6")
  const anchorPosition = () => evaluate("(()=>{const dot=document.querySelector('.analysis-connector circle');return [+dot.getAttribute('cx'),+dot.getAttribute('cy')]})()")
  const anchorBefore = await anchorPosition()
  await pause(500)
  const anchorAfter = await anchorPosition()
  assert.ok(Math.hypot(anchorAfter[0] - anchorBefore[0], anchorAfter[1] - anchorBefore[1]) > 0.1, 'The marker must follow the rotating surface instead of staying at a fixed screen location')
  await mouse('mousePressed', 650, 430, 'left', 1)
  await mouse('mouseMoved', 1435, 430, 'left', 1)
  await mouse('mouseReleased', 1435, 430, 'left', 0)
  await waitFor("Number(document.querySelector('.analysis-connector').style.opacity) === 0")
  await mouse('mousePressed', 1000, 430, 'left', 1)
  await mouse('mouseMoved', 215, 430, 'left', 1)
  await mouse('mouseReleased', 215, 430, 'left', 0)
  await waitFor("Number(document.querySelector('.analysis-connector').style.opacity) > 0.6")
  await evaluate("document.querySelectorAll('.section-list button')[1].click()")
  await pause(100)
  await waitFor("document.querySelector('.space-app').dataset.cameraMode === 'orbit'")
  await pause(800)
  assert.ok(Math.abs(await evaluate("window.__spaceAudio.at(-1).volume") - campVolume) < 0.005, 'Planet transfers must also preserve the camp volume')
  await click('.mute-button')
  await waitFor("window.__spaceAudio.at(-1).muted")
  await click('.mute-button')
  await waitFor("!window.__spaceAudio.at(-1).muted")
  await click('.panel-close')
  await waitFor("document.querySelector('.space-app').dataset.cameraMode === 'ground'")
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  await evaluate("document.querySelector('.section-list button').click()")
  await waitFor("document.querySelector('.space-app').dataset.cameraMode === 'orbit'")
  await click('.panel-close')
  await waitFor("document.querySelector('.space-app').dataset.cameraMode === 'ground'")
  await waitFor("!document.querySelector('.discovery-panel')")
  assert.deepEqual(errors, [])
  console.log('PASS: approaching/merging signal arcs, scan progress and completion, scope aiming and Space release after discovery, mute, smooth/cancellable menu exits, Escape, all destinations, orbital flight and return, camp music volume during orbit/transfers, rotating surface connector and occlusion, simultaneous desktop/mobile panels.')
} finally {
  if (audioProbeId) await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: audioProbeId })
  await send('Emulation.setEmulatedMedia', { features: [] })
  await send('Emulation.clearDeviceMetricsOverride')
  socket.close()
}
