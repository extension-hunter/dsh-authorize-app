# dsh-authorize-app

> A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) plugin that adds a **"Connected Apps / 连接应用"** settings section — a central platform where other DSH plugins can surface themselves.
> 一个 DSH 插件：在设置面板里新增「连接应用」区块，作为其他 DSH 插件自我展示的中央平台。

Out of the box it renders an **empty list**. Other apps opt in by registering a card into its slot — no registry, no network transport, no cross-plugin imports.

## What it does

- Adds a 5th entry to the Settings panel — **Connected Apps** (`order: 25`, after General / Models / Plugins / Agent Presets).
- Declares a child slot `settings.connected-apps.item` (`kind: list`) that any DSH plugin can register into.
- Renders that slot as the app list, with a bilingual empty state (`No connectable apps yet` / `暂无可连接的应用`).
- Also registers a placeholder host-side tool `dsh_authorize_app`.

## Install

```sh
# from the npm registry
dsh plugin --profile web add dsh-authorize-app

# from a local checkout (run from the PARENT directory)
dsh plugin --profile web add ./dsh-authorize-app
```

Then restart the profile (`dsh web`) and refresh the page. Settings → **连接应用 / Connected Apps** appears.

## For app developers

Want your app to show up in "Connected Apps"? In your plugin's **client half**, register a card into the child slot:

```js
ctx.slots.inject('settings.connected-apps.item', () =>
  ctx.slots.register({
    name: 'settings.connected-apps.item',
    id: 'your-app-id',      // unique id across all apps
    order: 0,               // sort order (ascending)
    inject: () => ({
      // anything your card needs: name, description, connection status, …
    }),
  }, YourAppCard),          // a React component; rendered inside the list
)
```

That is the entire contract:

- **No host-side registry.** The slot ledger is the join point.
- **No transport.** Your component is mounted by the platform's `renderSlot`, so you just render a card.
- **Install order is irrelevant.** `ctx.slots.inject(...)` waits for the slot declaration.

`YourAppCard` receives the standard DSH slot props: your `inject()` return value, plus the locale `t` seat if you declare a `locale:` namespace. Return `null` to hide, or render your card row.

### Minimal card example

```js
function YourAppCard(props) {
  return React.createElement('div', { style: { padding: '12px 0' } },
    'My App', ' — ', props.t ? props.t('status') : 'connected')
}
```

## Architecture

| Half | Source → dist | Role |
|---|---|---|
| Host (Node) | `src/index.ts` → `dist/index.js` | registers the `dsh_authorize_app` tool |
| Client (browser) | `client.js` → `dist/client.js` | registers the `settings.section` + child slot |

`package.json` declares `dsh.client` (`platform: web`) and the `./client` export. The host's client-modules scan serves `dist/client.js` at `/plugins/dsh-authorize-app/client.js` and injects it into `window.__DSH_BOOT__`.

## Build

```sh
pnpm install
pnpm run build        # tsc → dist/index.js; copies client.js → dist/client.js
pnpm run typecheck
```

## Layout

```
src/index.ts            host plugin (tool registration)
client.js               hand-authored client module bundle (window.__ModuleLoader__.load)
scripts/build-client.mjs  copies client.js → dist/client.js
cordis.patch.yml        bundle patch layer (inserts this plugin into a profile)
```

## Pitfalls (for maintainers)

1. **npm dist-tag trap** — `@deepseek-ai/dsh-tools` `latest` is a stale `0.0.1-rc.1`; the real line is under the `next` tag (`0.1.0-rc.x`). This package pins the `next` version exactly; do not re-install it over the pin.
2. **Client-half discovery** — the host scan does `require.resolve('<pkg>/package.json')`, so `exports` MUST include `"./package.json": "./package.json"` and `"./client"`. Missing either makes the client half silently skipped (host loads, `/plugins/<pkg>/client.js` 404s).
3. **Node version** — DSH requires `^22.19.0 || >=24.0.0`.
4. **`@deepseek-ai/cordis` is a peerDependency** — import only `type { Context }` (erased at compile); the host hands you `ctx` at runtime.

## License

MIT
