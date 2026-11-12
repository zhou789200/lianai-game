import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = 'C:/Users/19511/Desktop/lianai-game/work/demo'
const OUT = path.join(ROOT, 'narration')
fs.mkdirSync(OUT, { recursive: true })

const scenes = JSON.parse(fs.readFileSync(path.join(ROOT, 'narration.json'), 'utf8'))
const VOICE = process.env.VOICE || 'zh-CN-XiaoxiaoNeural'
const RATE = Number(process.env.RATE || 0.96)

for (const s of scenes) {
  const file = path.join(OUT, `${s.id}.mp3`)
  if (fs.existsSync(file) && !process.env.FORCE) {
    console.log('skip', s.id)
    continue
  }
  const tts = new MsEdgeTTS({ connectionTimeoutMs: 20000, synthesisTimeoutMs: 60000 })
  await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3)
  const { audioStream } = tts.toStream(s.text, { rate: RATE, pitch: '0Hz', volume: 96 })
  const chunks = []
  await new Promise((res, rej) => {
    audioStream.on('data', (c) => chunks.push(c))
    audioStream.once('end', res)
    audioStream.once('error', rej)
  })
  fs.writeFileSync(file, Buffer.concat(chunks))
  tts.close()
  console.log('ok', s.id, (Buffer.concat(chunks).length / 1024).toFixed(0) + 'KB')
}
console.log('done')
