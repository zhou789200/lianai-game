import assert from 'node:assert/strict'
import http from 'node:http'
import test from 'node:test'
import {
  createStoryVoiceMiddleware,
  resolveStoryVoiceProfile,
  sanitizeStoryVoiceRequest,
} from '../server/story-voice-api.mjs'
import {
  normalizeOnlineVoiceFailure,
  shouldUseSystemVoiceFallback,
} from '../shared/storyVoiceFailure.mjs'

const AUDIO = Buffer.concat([Buffer.from([0xff, 0xf3, 0xa4, 0xc4]), Buffer.alloc(256)])

async function startServer(options = {}) {
  const middleware = createStoryVoiceMiddleware({
    synthesize: async () => AUDIO,
    ...options,
  })
  const server = http.createServer((req, res) => {
    void middleware(req, res, () => {
      res.statusCode = 404
      res.end()
    })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  return {
    url: `http://127.0.0.1:${address.port}/api/story/voice`,
    close: () => new Promise((resolve) => server.close(resolve)),
  }
}

test('story voice maps narration and Lin Che to distinct natural voices', () => {
  const narration = resolveStoryVoiceProfile('旁白')
  const linChe = resolveStoryVoiceProfile('林澈')
  const alternateSpelling = resolveStoryVoiceProfile('林撤')

  assert.equal(narration.voice, 'zh-CN-XiaoxiaoNeural')
  assert.equal(linChe.voice, 'zh-CN-YunjianNeural')
  assert.equal(alternateSpelling.voice, linChe.voice)
  assert.equal(narration.rate, 0.94)
  assert.equal(linChe.rate, 0.88)
})

test('online voice timeout falls back to system speech while cancellation stays silent', () => {
  const cancellation = new DOMException('Cancelled', 'AbortError')
  const timeoutFailure = normalizeOnlineVoiceFailure(cancellation, true)
  const networkFailure = new Error('network unavailable')

  assert.equal(timeoutFailure.name, 'OnlineVoiceTimeoutError')
  assert.equal(shouldUseSystemVoiceFallback(timeoutFailure), true)
  assert.equal(shouldUseSystemVoiceFallback(networkFailure), true)
  assert.equal(shouldUseSystemVoiceFallback(cancellation), false)
})

test('story voice request trims and validates text', () => {
  const request = sanitizeStoryVoiceRequest({
    speaker: '林澈',
    text: '  海风停了一拍。  咖啡杯轻轻碰到托盘。 ',
  })
  assert.equal(request.text, '海风停了一拍。 咖啡杯轻轻碰到托盘。')

  assert.throws(
    () => sanitizeStoryVoiceRequest({ speaker: '旁白', text: '   ' }),
    /不能为空/,
  )
  assert.throws(() => sanitizeStoryVoiceRequest('bad body'), /格式不正确/)
})

test('story voice endpoint returns MP3 and caches repeated lines', async () => {
  let calls = 0
  const server = await startServer({
    synthesize: async () => {
      calls += 1
      return AUDIO
    },
  })

  try {
    const body = JSON.stringify({
      speaker: '旁白',
      text: '潮水退下去以后，门口留下了一小片亮光。',
    })
    for (let index = 0; index < 2; index += 1) {
      const response = await fetch(server.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('content-type'), 'audio/mpeg')
      assert.equal(response.headers.get('x-story-voice'), 'zh-CN-XiaoxiaoNeural')
      const audio = Buffer.from(await response.arrayBuffer())
      assert.equal(audio.length, AUDIO.length)
      assert.deepEqual(audio.subarray(0, 4), AUDIO.subarray(0, 4))
    }
    assert.equal(calls, 1)
  } finally {
    await server.close()
  }
})

test('story voice deduplicates concurrent synthesis for the same line', async () => {
  let calls = 0
  let finishSynthesis
  const synthesized = new Promise((resolve) => {
    finishSynthesis = resolve
  })
  const server = await startServer({
    synthesize: async () => {
      calls += 1
      await synthesized
      return AUDIO
    },
  })
  const body = JSON.stringify({ speaker: '林澈', text: '同一句话只合成一次。' })
  const request = () =>
    fetch(server.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })

  try {
    const first = request()
    const second = request()
    await new Promise((resolve) => setTimeout(resolve, 30))
    finishSynthesis()
    const responses = await Promise.all([first, second])
    assert.deepEqual(
      responses.map((response) => response.status),
      [200, 200],
    )
    await Promise.all(responses.map((response) => response.arrayBuffer()))
    assert.equal(calls, 1)
  } finally {
    await server.close()
  }
})

test('story voice aborts upstream synthesis when the client disconnects', async () => {
  let started
  const synthesisStarted = new Promise((resolve) => {
    started = resolve
  })
  let upstreamSignal
  const server = await startServer({
    synthesize: async (_text, _profile, { signal }) => {
      upstreamSignal = signal
      started()
      return new Promise((_resolve, reject) => {
        signal.addEventListener(
          'abort',
          () => reject(new DOMException('Aborted', 'AbortError')),
          { once: true },
        )
      })
    },
  })
  const controller = new AbortController()

  try {
    const request = fetch(server.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ speaker: '旁白', text: '翻页时应停止上一句。' }),
      signal: controller.signal,
    }).catch(() => null)
    await synthesisStarted
    controller.abort()
    await request

    const deadline = Date.now() + 1000
    while (!upstreamSignal?.aborted && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    assert.equal(upstreamSignal?.aborted, true)
  } finally {
    await server.close()
  }
})

test('story voice endpoint reports upstream failures without hanging', async () => {
  const server = await startServer({
    synthesize: async () => {
      throw new Error('upstream unavailable')
    },
  })

  try {
    const response = await fetch(server.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ speaker: '林澈', text: '今天先到这里。' }),
    })
    assert.equal(response.status, 502)
    assert.deepEqual(await response.json(), { error: '自然语音暂时不可用' })
  } finally {
    await server.close()
  }
})
