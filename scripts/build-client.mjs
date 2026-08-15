// Copy the hand-authored client bundle into dist/ so it ships under the
// package's `./client` export (dist/client.js). The host client-modules scan
// serves that file at /plugins/dsh-authorize-app/client.js.
import { copyFileSync, mkdirSync } from 'node:fs'

mkdirSync('dist', { recursive: true })
copyFileSync('client.js', 'dist/client.js')
