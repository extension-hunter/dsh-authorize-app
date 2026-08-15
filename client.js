// dsh-authorize-app — client half: a "Connected Apps" settings section.
//
// This is a HAND-WRITTEN client module bundle in the exact shape the DSH web
// shell consumes: `window.__ModuleLoader__.load({ id, factory })`. The factory
// receives the synchronous `require` bound to the browser module table and
// materializes this module's exports ({ apply, inject }) on first import.
// Dependencies are pulled from the shell's frozen platform module table
// (react, cordis, dsh-client-ui-slots, ...) — never bundled in here.
//
// The host serves this file at /plugins/dsh-authorize-app/client.js once the
// package declares `dsh.client` (see package.json) and is loaded into a
// profile. Build copies this file to dist/client.js (scripts/build-client.mjs).
//
// Platform model: this section is the "central platform". It renders a set of
// DEFAULT app cards (Gmail, Notion) plus a child slot —
// `settings.connected-apps.item` — which other plugins can register cards into.
// No host-side registry or transport is needed for the cards themselves.

window.__ModuleLoader__.load({
  id: 'dsh-authorize-app',
  factory: (require) => {
    const React = require('react')

    // Inject the Install-button spinner keyframes once.
    if (typeof document !== 'undefined' && !document.querySelector('style[data-plugin-css="dsh-authorize-app"]')) {
      const tag = document.createElement('style')
      tag.dataset.plugin = 'dsh-authorize-app'
      tag.dataset.pluginCss = 'dsh-authorize-app'
      tag.textContent = '@keyframes dsh-authorize-app-spin{to{transform:rotate(360deg)}}'
      document.head.appendChild(tag)
    }

    // Locale namespace for this section's copy (bilingual zh/en).
    const NS = 'settings.connected-apps'

    // Default apps shown by the platform. Card UI only for now: `install` is a
    // simulated async flow (loading → installed). There is no web-UI plugin
    // install API in DSH yet — a real install goes through `dsh plugin add`
    // plus a profile restart — so `onInstall` below is a stub with a seam for
    // a real host call later.
    // Official brand marks (Simple Icons paths, 24×24 viewBox).
    const GMAIL_ICON = 'M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z'
    const NOTION_ICON = 'M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z'
    const DEFAULT_APPS = [
      { id: 'gmail', name: 'Gmail', pkg: 'dsh-gmail', iconPath: GMAIL_ICON, iconColor: '#EA4335', descKey: 'gmail.desc' },
      { id: 'notion', name: 'Notion', pkg: 'dsh-notion', iconPath: NOTION_ICON, iconColor: '#000000', descKey: 'notion.desc' },
    ]

    const cardStyle = {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      padding: '14px',
      border: '1px solid var(--dsw-alias-border-l2)',
      borderRadius: '12px',
      background: 'var(--dsw-alias-bg-module-platform)',
    }
    const nameStyle = {
      fontWeight: 500,
      fontSize: '14px',
      lineHeight: '22px',
      color: 'var(--dsw-alias-label-primary)',
    }
    const descStyle = {
      fontSize: '12px',
      lineHeight: '18px',
      color: 'var(--dsw-alias-label-tertiary)',
      marginTop: '2px',
    }
    const buttonStyle = {
      marginTop: '2px',
      alignSelf: 'flex-end',
      height: '28px',
      padding: '0 12px',
      borderRadius: '14px',
      border: '1px solid var(--dsw-alias-border-l2)',
      background: 'transparent',
      color: 'var(--dsw-alias-label-primary)',
      fontSize: '12px',
      lineHeight: '18px',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
    }
    const installedButtonStyle = {
      color: 'var(--dsw-alias-label-tertiary)',
      borderColor: 'var(--dsw-alias-border-l3)',
    }

    function Spinner() {
      return React.createElement('span', {
        style: {
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          border: '2px solid var(--dsw-alias-border-l3)',
          borderTopColor: 'var(--dsw-alias-brand-primary)',
          animation: 'dsh-authorize-app-spin 0.8s linear infinite',
          display: 'inline-block',
          flexShrink: 0,
        },
      })
    }

    function BrandIcon(props) {
      const { app, size } = props
      return React.createElement(
        'svg',
        { viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': 'true', style: { flexShrink: 0 } },
        React.createElement('path', { d: app.iconPath, fill: app.iconColor }),
      )
    }

    // One app card. Install state machine:
    //   loading → install → installing → restart → installed
    // `install`   = not installed in the profile.
    // `restart`   = installed, but not active yet (needs `dsh web` restart).
    // `installed` = installed AND active.
    function AppCard(props) {
      const { app, t, api } = props
      const [status, setStatus] = React.useState('loading')

      React.useEffect(() => {
        let alive = true
        ;(async () => {
          try {
            const [installed, active] = await Promise.all([api.installed(), api.active()])
            if (!alive) return
            if (!installed.has(app.pkg)) setStatus('install')
            else if (!active.has(app.pkg)) setStatus('restart')
            else setStatus('installed')
          } catch {
            if (alive) setStatus('install')
          }
        })()
        return () => {
          alive = false
        }
      }, [])

      const onInstall = async () => {
        if (status !== 'install') return
        setStatus('installing')
        try {
          await api.install(app.pkg)
          setStatus('restart') // installed now, active only after a restart
        } catch {
          setStatus('install')
        }
      }

      const loading = status === 'loading'
      const installing = status === 'installing'
      const restart = status === 'restart'
      const installed = status === 'installed'
      const label = loading
        ? ''
        : installed
          ? t('installed')
          : restart
            ? t('restart')
            : installing
              ? t('installing')
              : t('install')

      return React.createElement(
        'div',
        { style: cardStyle },
        React.createElement(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
          React.createElement(BrandIcon, { app, size: 28 }),
          React.createElement(
            'div',
            { style: { flex: 1, minWidth: 0 } },
            React.createElement('div', { style: nameStyle }, app.name),
            React.createElement('div', { style: descStyle }, t(app.descKey)),
          ),
        ),
        React.createElement(
          'button',
          {
            type: 'button',
            onClick: onInstall,
            disabled: status !== 'install',
            style: {
              ...buttonStyle,
              ...(installed || restart ? installedButtonStyle : {}),
              ...(restart ? { color: 'var(--dsw-alias-state-warn-label)', borderColor: 'var(--dsw-alias-state-warn-label)' } : {}),
              cursor: status === 'install' ? 'pointer' : 'default',
              opacity: status === 'install' ? 1 : 0.85,
            },
          },
          loading || installing ? React.createElement(Spinner) : null,
          label,
        ),
      )
    }

    // The section body: a two-column grid of default cards plus the child slot.
    // The renderSlot outlet is `display: contents`, so plugin-registered cards
    // join the same grid as the default cards.
    function ConnectedAppsSection(props) {
      const { t, api, renderSlot } = props
      return React.createElement(
        'div',
        { style: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px', width: '100%' } },
        DEFAULT_APPS.map((app) => React.createElement(AppCard, { key: app.id, app, t, api })),
        renderSlot('settings.connected-apps.item', {}, { fallback: null }),
      )
    }

    // Required services: the slot registry, the locale registry, and the
    // generated Remote face for the host plugin inventory (so cards can read
    // the REAL installed state).
    const inject = ['slots', 'locale', 'remote', 'remote.pluginInventory']

    function apply(ctx) {
      ctx.effect(
        () =>
          ctx.locale.register(NS, {
            zh: {
              nav: '连接应用',
              install: '安装',
              installing: '安装中…',
              restart: '已安装，需重启',
              installed: '已安装',
              'gmail.desc': '连接邮箱，让 DSH 搜索并读取邮件。仅申请只读权限。',
              'notion.desc': '连接 Notion 工作区，让 DSH 搜索并读取你授权的页面。此插件只读取、不修改内容。',
            },
            en: {
              nav: 'Connected Apps',
              install: 'Install',
              installing: 'Installing…',
              restart: 'Installed — restart required',
              installed: 'Installed',
              'gmail.desc': 'Connect your mailbox so DSH can search and read messages with read-only access.',
              'notion.desc': 'Connect a Notion workspace so DSH can search and read the pages you authorize. Read-only access.',
            },
          }),
        'dsh-authorize-app: locale',
      )

      const t = ctx.locale.bind(NS)

      // Platform API used by the cards:
      //   installed() — installed packages, from the host route (profile deps).
      //   active()    — active plugins, from the host plugin inventory.
      //   install()   — really install via the host route (runs `pnpm add`).
      const api = {
        installed: async () => {
          const res = await fetch('/connected-apps/installed')
          const data = await res.json()
          return new Set(data.installed ?? [])
        },
        active: async () => {
          const result = await ctx.remote.pluginInventory.list()
          if (!result.ok) return new Set()
          return new Set(
            (result.value.entries ?? [])
              .filter((entry) => entry.enabled && entry.fiberPhase === 'active')
              .map((entry) => entry.moduleName),
          )
        },
        install: async (pkg) => {
          const res = await fetch('/connected-apps/install', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ pkg }),
          })
          const data = await res.json()
          if (!res.ok || !data.ok) throw new Error(data.error ?? 'install failed')
        },
      }

      // Register the 5th settings section. `settings.section` is declared by
      // the settings shell (ui-settings-general); `slots.inject` waits for that
      // declaration, so this contribution lands regardless of load order.
      // `children` declares the child slot that other apps register into.
      ctx.slots.inject(
        'settings.section',
        () =>
          ctx.slots.register(
            {
              name: 'settings.section',
              id: 'connected-apps',
              order: 25,
              label: () => t('nav'),
              inject: () => ({ t, api }),
              children: {
                'settings.connected-apps.item': { kind: 'list', scope: 'root' },
              },
            },
            ConnectedAppsSection,
          ),
      )
    }

    return { apply, inject }
  },
})
