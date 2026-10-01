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
const progress = () => evaluate("1 - Number(document.querySelector('.scope-completion-band circle').style.strokeDashoffset)")
const mouse = (type, x, y, button = 'right', buttons = 2) => send('Input.dispatchMouseEvent', { type, x, y, button, buttons, clickCount: 1 })
try {
  await send('Runtime.enable')
  await send('Page.enable')
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
  assert.equal(await evaluate("document.querySelectorAll('[data-discovered=true]').length"), 0)
  await mouse('mousePressed', 1000, 650)
  await mouse('mouseMoved', 729, 385)
  await waitFor("document.querySelector('.signal-readout strong')?.textContent === 'Wanderer'")
  assert.equal(await evaluate("document.querySelector('.scope-button').getAttribute('aria-pressed')"), 'true')
  assert.equal(await evaluate("document.querySelectorAll('[data-discovered=true]').length"), 0, 'A partial scan must not discover the planet')
  const first = await progress()
  await pause(150)
  assert.ok(await progress() > first, 'Progress must advance while aiming')
  await waitFor("!!document.querySelector('.discovery-confirmation')")
  assert.equal(await evaluate("!!document.querySelector('.discovery-panel')"), false, 'Play completion before opening the story')
  assert.equal(await evaluate("document.querySelectorAll('[data-discovered=true]').length"), 1)
  await waitFor("document.querySelector('.discovery-panel h1')?.textContent === 'Logan Zhao'")
  await mouse('mouseReleased', 729, 385, 'right', 0)
  assert.equal(await evaluate("document.querySelector('.scope-button').getAttribute('aria-pressed')"), 'false')
  await click('.panel-close')
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
  await pause(1600)
  assert.equal(await evaluate("!!document.querySelector('.discovery-panel')"), false, 'Escape must cancel delayed opening')
  await click('.sections-button')
  const titles = await evaluate("[...document.querySelectorAll('.section-list strong')].map(e => e.textContent)")
  for (let i = 0; i < titles.length; i++) {
    await evaluate(`document.querySelectorAll('.section-list button')[${i}].click()`)
    await waitFor('!!document.querySelector(".discovery-panel")')
    assert.equal(await evaluate("document.querySelector('.discovery-panel h1').textContent"), titles[i])
    await click('.sections-button')
  }
  assert.equal(await evaluate("document.querySelectorAll('[data-discovered=true]').length"), 8)
  assert.deepEqual(errors, [])
  console.log('PASS: real planet portraits, scope aiming with either mouse button, scan progress and completion, Escape cancellation, all field-log destinations.')
} finally {
  await send('Emulation.clearDeviceMetricsOverride')
  socket.close()
}
