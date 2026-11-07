import { fileURLToPath } from 'node:url'
import { loadEnv, preview } from 'vite'
import { createStoryMiddleware } from '../server/story-api.mjs'
import { createUserMiddleware } from '../server/user-api.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const env = loadEnv('production', root, '')
for (const [key, value] of Object.entries(env)) {
  if (process.env[key] === undefined) process.env[key] = value
}

const storyApiPlugin = {
  name: 'seabreeze-story-api',
  configurePreviewServer(server) {
    server.middlewares.use(createStoryMiddleware())
  },
}

const userApiPlugin = {
  name: 'seabreeze-user-api',
  configurePreviewServer(server) {
    const middleware = createUserMiddleware()
    server.middlewares.use(middleware)
    server.httpServer?.once('close', () => middleware.close())
  },
}

const server = await preview({
  configFile: false,
  root,
  plugins: [storyApiPlugin, userApiPlugin],
  base: './',
  preview: {
    host: true,
    port: 4173,
  },
})

server.printUrls()
