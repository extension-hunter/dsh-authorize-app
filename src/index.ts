// dsh-authorize-app — host half.
//
// Two jobs:
//   1. Register the `dsh_authorize_app` tool (kept from the scaffold).
//   2. Expose two localhost HTTP routes the web client uses for the
//      "Connected Apps" platform:
//        GET  /connected-apps/installed  → which plugin packages are installed
//                                          in this profile (dependencies + bundles)
//        POST /connected-apps/install    → really run `pnpm add <pkg>` in the
//                                          profile directory and reconcile the
//                                          bundle list (this is what
//                                          `dsh plugin add` does under the hood)
//
// Why HTTP routes instead of a Typert Remote service: simpler, and it matches
// the existing `dsh-gmail` / `dsh-notion` pattern (`/auth/<app>/connect`).

import { readFile, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'

// Plugin display name, shown in loader diagnostics.
export const name = 'dsh-authorize-app'

// Wait until the tool registry and the web server are ready.
export const inject = ['tools', 'webServer']

// Packages the platform may install. Kept in step with the client's DEFAULT_APPS.
const INSTALLABLE = new Set(['dsh-gmail', 'dsh-notion'])

const INSTALLED_PATH = '/connected-apps/installed'
const INSTALL_PATH = '/connected-apps/install'

// Minimal structural type for the host-provided webServer service, so this
// package does not need `@deepseek-ai/dsh-host-webserver` as a dependency.
interface WebServerLike {
  register(spec: {
    kind: 'exact' | 'prefix'
    path: string
    handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
  }): () => void
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as Record<string, unknown>
  } catch {
    return {}
  }
}

export function apply(ctx: Context) {
  ctx.tools.register(defineTool({
    name: 'dsh_authorize_app',
    description: 'Return the current time and process environment info (example tool).',

    parameters: {
      tz: {
        type: 'string',
        description: "IANA timezone name, e.g. 'Asia/Shanghai'. Defaults to the system local timezone.",
      },
    },

    output: {
      schema: {
        type: 'object',
        properties: {
          iso: { type: 'string', required: true, description: 'ISO-8601 timestamp (UTC).' },
          unixMs: { type: 'integer', required: true, description: 'Unix epoch milliseconds.' },
          tz: { type: 'string', required: true, description: 'Timezone actually used.' },
          nodeVersion: { type: 'string', required: true, description: 'process.version' },
          platform: { type: 'string', required: true, description: 'process.platform' },
        },
        additionalProperties: false,
      },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },

    async execute(args) {
      const tz = args.tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone
      const now = new Date()
      return {
        iso: now.toISOString(),
        unixMs: now.getTime(),
        tz,
        nodeVersion: process.version,
        platform: process.platform,
      }
    },
  }))

  const webServer = (ctx as Context & { webServer: WebServerLike }).webServer
  const baseUrl = (ctx as Context & { baseUrl: string }).baseUrl
  const profileDir = fileURLToPath(baseUrl)

  // Installed = the profile's package.json dependencies ∪ dsh.profile.bundles.
  async function installedPackages(): Promise<string[]> {
    const manifest = JSON.parse(await readFile(join(profileDir, 'package.json'), 'utf8'))
    const deps = Object.keys(manifest.dependencies ?? {})
    const bundles: string[] = manifest.dsh?.profile?.bundles ?? []
    return [...new Set([...deps, ...bundles])]
  }

  // After `pnpm add`, mirror the `dsh plugin` reconcile: append the package to
  // dsh.profile.bundles when it declares `dsh.bundle.patch`.
  async function reconcileBundle(pkgName: string): Promise<void> {
    const pkgPath = join(profileDir, 'package.json')
    const manifest = JSON.parse(await readFile(pkgPath, 'utf8'))
    let isBundle = false
    try {
      const installed = JSON.parse(await readFile(join(profileDir, 'node_modules', pkgName, 'package.json'), 'utf8'))
      isBundle = typeof installed.dsh?.bundle?.patch === 'string'
    } catch {
      isBundle = false
    }
    const bundles: string[] = manifest.dsh?.profile?.bundles ?? []
    if (isBundle && !bundles.includes(pkgName)) {
      manifest.dsh = { ...manifest.dsh, profile: { ...manifest.dsh?.profile, bundles: [...bundles, pkgName] } }
      await writeFile(pkgPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
    }
  }

  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: INSTALLED_PATH,
    handler: async (req, res) => {
      if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'method-not-allowed' })
      try {
        sendJson(res, 200, { ok: true, installed: await installedPackages() })
      } catch (error) {
        sendJson(res, 500, { ok: false, error: String(error) })
      }
    },
  }), 'dsh-authorize-app: installed route')

  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: INSTALL_PATH,
    handler: async (req, res) => {
      if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method-not-allowed' })
      const body = await readJsonBody(req)
      const pkg = String(body.pkg ?? '')
      if (!INSTALLABLE.has(pkg)) return sendJson(res, 400, { ok: false, error: 'package-not-allowed' })
      try {
        await new Promise<void>((resolve, reject) => {
          const child = spawn('pnpm', ['add', pkg], { cwd: profileDir, stdio: 'ignore' })
          child.on('error', reject)
          child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`pnpm add exited with code ${code}`))))
        })
        await reconcileBundle(pkg)
        sendJson(res, 200, { ok: true, installed: await installedPackages() })
      } catch (error) {
        sendJson(res, 500, { ok: false, error: String(error) })
      }
    },
  }), 'dsh-authorize-app: install route')

  console.log(
    `[dsh-authorize-app] registered "dsh_authorize_app" — listed=${ctx.tools.get('dsh_authorize_app') !== undefined}; ` +
      `connected-apps routes: ${INSTALLED_PATH}, ${INSTALL_PATH}`,
  )
}
