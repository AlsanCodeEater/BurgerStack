# BurgerStack Visual QA Report

## Automated QA Harness Setup
- **Browser Automation Library:** `@playwright/test`
- **Target Configurations:** 
  - Desktop: 1440x900
  - Tablet: 1024x768
  - Mobile: 390x844
- **Scroll State Control:** Injected deterministic `window.__BURGER_DEBUG__.setProgress(val)` hook into `HeroAndExploded.tsx` to force precision scroll coordinates without manual mouse drift.

## Execution Status
**FAIL (Infrastructure Blocker)**

Chromium successfully launched natively on the host, but the `page.screenshot()` capture system hangs indefinitely inside the headless container with the following stack trace:

```
Screenshot Failed for desktop-01-hero.png: page.screenshot: Timeout 8000ms exceeded.
Call log:
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
```

Due to the restricted host environment (which previously caused corporate proxy certificate blocks on Chrome downloads), the headless virtual renderer is failing to resolve `document.fonts.ready` and WebGL contexts when attempting to flush the screenshot buffer, even when forced to software rasterization (`--use-gl=swiftshader`) and explicitly aborting web font network requests.

## Developer Next Steps
The complete visual QA automation suite has been written and saved locally to your project at `I:\BurgerStack\qa\visual-qa.mjs`.

To run this visual QA pass yourself on a host environment with proper hardware acceleration and unrestricted network access:

1. Ensure the dev server is running on port 3000.
2. Run `node qa/visual-qa.mjs`.
3. Inspect the resulting `.png` files generated in the `qa/screenshots/` directory for any clipping or alignment issues across the Hero, Explosion, Rebuild, and Configurator checkpoints.
