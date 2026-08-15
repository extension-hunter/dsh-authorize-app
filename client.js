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
// Platform model: this section is the "central platform". It declares one
// child slot — `settings.connected-apps.item` — which other apps fill by
// registering a card into it. No host-side registry or transport is needed:
// the slot ledger is the join point. Apps show up automatically once installed
// into the same profile. While no app is registered, the empty-state renders.

window.__ModuleLoader__.load({
  id: 'dsh-authorize-app',
  factory: (require) => {
    const React = require('react')

    // Locale namespace for this section's copy (bilingual zh/en).
    const NS = 'settings.connected-apps'

    // The section body: renders the child slot. Other apps contribute cards
    // into `settings.connected-apps.item`; while empty, the fallback shows the
    // empty-state note.
    function ConnectedAppsSection(props) {
      const emptyState = React.createElement(
        'div',
        {
          style: {
            padding: '24px 0',
            color: 'var(--dsw-alias-label-tertiary)',
            fontSize: '14px',
            lineHeight: '22px',
          },
        },
        props.t('empty'),
      )
      return React.createElement(
        'div',
        { style: { display: 'flex', flexDirection: 'column', width: '100%' } },
        props.renderSlot('settings.connected-apps.item', {}, { fallback: emptyState }),
      )
    }

    // Required services: the slot registry (`ctx.slots`) and the locale
    // registry (`ctx.locale`). Both are provided by the web shell's base
    // composition, so this plugin just waits on them.
    const inject = ['slots', 'locale']

    function apply(ctx) {
      // Register bilingual copy; the disposer returned by locale.register is
      // wired through ctx.effect so it tears down on unload.
      ctx.effect(
        () =>
          ctx.locale.register(NS, {
            zh: {
              nav: '连接应用',
              empty: '暂无可连接的应用',
            },
            en: {
              nav: 'Connected Apps',
              empty: 'No connectable apps yet',
            },
          }),
        'dsh-authorize-app: locale',
      )

      const t = ctx.locale.bind(NS)

      // Register the 5th settings section. `settings.section` is declared by
      // the settings shell (ui-settings-general); `slots.inject` waits for that
      // declaration, so this contribution lands regardless of load order.
      // The four shipped sections are general(0) / models(10) / plugins(15) /
      // agent-presets(20); this one slots in after them at order 25.
      //
      // `children` declares the child slot that other apps register into. Only
      // this entry may render that slot (`renderSlot` arrives on the component
      // props), which is what makes this section the single join point.
      ctx.slots.inject(
        'settings.section',
        () =>
          ctx.slots.register(
            {
              name: 'settings.section',
              id: 'connected-apps',
              order: 25,
              label: () => t('nav'),
              inject: () => ({ t }),
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
