import { ProofBrokerStore } from './src/store.ts'
import { createProofBrokerServer } from './src/http.ts'

const host = process.env.HOST ?? '127.0.0.1'
const port = Number(process.env.PORT ?? '8787')

const store = new ProofBrokerStore()
const server = createProofBrokerServer(store)

server.listen(port, host, () => {
  console.log(`m8 proof broker listening on http://${host}:${port}`)
})

function shutdown(signal: string) {
  console.log(`Received ${signal}, shutting down broker server`)
  server.close(() => process.exit(0))
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

