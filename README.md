# venture-prototype

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Compile and Minify for Production

```sh
npm run build
```

## Data mode

Choose **Demo** or **Production** on the login page. Demo mode uses seeded mock
data persisted in the browser; Production sends app data and authentication
requests to Supabase. The choice is remembered in the browser and takes effect
after the app reloads. Configure both `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` (see `.env.example`) to enable Production mode.

The admin dashboard has its own Demo/Production toggle on `/dashboard/login`.
Its mode is independent from the app login and is remembered in the browser.
`VITE_DASHBOARD_USE_SUPABASE=true` makes Supabase the dashboard's initial mode;
the login toggle can change it afterwards.
