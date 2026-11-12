import { fileURLToPath } from 'node:url'
import { createServer, loadEnv } from 'vite'
import { createStoryMiddleware } from '../server/story-api.mjs'
import { createStoryVoiceMiddleware } from '../server/story-voice-api.mjs'
import { createUserMiddleware } from '../server/user-api.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const env = loadEnv('development', root, '')
for (const [key, value] of Object.entries(env)) {
  if (process.env[key] === undefined) process.env[key] = value
}

const port = Number(process.env.PORT ?? 5173)

const storyApiPlugin = {
  name: 'seabreeze-story-api',
  configureServer(server) {
    server.middlewares.use(createStoryMiddleware())
    server.middlewares.use(createStoryVoiceMiddleware())
  },
}

const userApiPlugin = {
  name: 'seabreeze-user-api',
  configureServer(server) {
    const middleware = createUserMiddleware()
    server.middlewares.use(middleware)
    server.httpServer?.once('close', () => middleware.close())
  },
}

const server = await createServer({
  configFile: false,
  root,
  plugins: [
    (await import('@vitejs/plugin-react')).default(),
    storyApiPlugin,
    userApiPlugin,
  ],
  base: './',
  server: {
    host: true,
    port,
    strictPort: true,
  },
})

await server.listen()
server.printUrls()
