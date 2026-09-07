process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1';

import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

(async () => {
  const browser = await chromium.launch({ 
    headless: true, 
    args: ['--use-gl=swiftshader', '--disable-dev-shm-usage', '--disable-gpu'] 
  });
  
  const viewports = [
    { width: 1440, height: 900, name: 'desktop' }
  ];

  let errors = [];
  const diagnostics = [];

  for (const vp of viewports) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();

    page.on('console', msg => {
      console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`);
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('THREE.Clock') && !text.includes('favicon')) {
            errors.push(`[${vp.name}] Console Error: ${text}`);
        }
      }
    });
    
    page.on('pageerror', err => {
      errors.push(`[${vp.name}] Page Error: ${err.message}`);
    });

    console.log(`Starting QA pass for ${vp.name}...`);
    
    try {
      await page.goto('http://127.0.0.1:3000', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      
      await page.waitForFunction(() => {
        return !!window.__BURGER_DEBUG__;
      }, { timeout: 10000 });

      await page.waitForFunction(() => {
        return !!document.querySelector('canvas');
      }, { timeout: 15000 });
      await page.waitForTimeout(2000);
    } catch(e) {
      console.error(`Page load/wait failed for ${vp.name}: ${e.message}`);
      errors.push(`Page load failed for ${vp.name}`);
      const html = await page.content();
      console.log('HTML Dump:', html);
      await context.close();
      continue;
    }

    const setProgress = async (val) => {
      await page.evaluate((v) => window.__BURGER_DEBUG__.setProgress(v), val);
      await page.evaluate(() => new Promise(resolve => {
        requestAnimationFrame(() => {
          requestAnimationFrame(resolve);
        });
      }));
      await page.waitForTimeout(250);
    };

    const snap = async (name) => {
      console.log(`Preparing to take screenshot: ${name}`);
      
      const diag = await page.evaluate(() => {
        const canvas = document.querySelector('canvas');
        return {
          url: window.location.href,
          viewport: { width: window.innerWidth, height: window.innerHeight },
          storyProgress: window.__BURGER_DEBUG__?.state?.storyProgress,
          activeLayer: window.__BURGER_DEBUG__?.state?.activeLayer,
          canvasRect: canvas?.getBoundingClientRect(),
          canvasWidth: canvas?.width,
          canvasHeight: canvas?.height,
          devicePixelRatio: window.devicePixelRatio,
          fontStatus: document.fonts.status
        };
      });
      diagnostics.push({ name, diag });
      console.log(`Diagnostics for ${name}:`, JSON.stringify(diag, null, 2));

      if (!diag.canvasWidth || !diag.canvasHeight || diag.canvasWidth === 0 || diag.canvasHeight === 0) {
        console.error(`Canvas dimensions are 0x0 or invalid. Skipping ${name}.`);
        errors.push(`Canvas invalid for ${name}`);
        return;
      }

      try {
        await page.screenshot({ path: `qa/screenshots/${name}`, timeout: 30000 });
        console.log(`Done standard screenshot: ${name}`);
      } catch(e) {
        console.log(`Standard screenshot Failed for ${name}: ${e.message}`);
        
        console.log(`Attempting CDP fallback for ${name}...`);
        try {
          const client = await context.newCDPSession(page);
          const { data } = await client.send('Page.captureScreenshot', { format: 'png' });
          fs.writeFileSync(`qa/screenshots/${name}-cdp.png`, Buffer.from(data, 'base64'));
          console.log(`CDP fallback successful: ${name}-cdp.png`);
        } catch(cdpError) {
          console.log(`CDP fallback Failed for ${name}: ${cdpError.message}`);
          
          console.log(`Attempting Canvas fallback for ${name}...`);
          try {
            const dataUrl = await page.evaluate(() => {
              const canvas = document.querySelector('canvas');
              return canvas ? canvas.toDataURL('image/png') : null;
            });
            if (dataUrl) {
              const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
              fs.writeFileSync(`qa/screenshots/${name}-canvas.png`, Buffer.from(base64Data, 'base64'));
              console.log(`Canvas fallback successful: ${name}-canvas.png`);
            } else {
              throw new Error("Canvas element not found or returned null for toDataURL");
            }
          } catch(canvasError) {
            console.log(`Canvas fallback Failed for ${name}: ${canvasError.message}`);
            errors.push(`All screenshots failed for: ${name}`);
          }
        }
      }
    };

    await setProgress(0);
    await snap(`smoke-hero.png`);

    await setProgress(0.26);
    await snap(`smoke-explosion.png`);

    await setProgress(1);
    await snap(`smoke-final.png`);

    await context.close();
  }

  await browser.close();
  
  fs.writeFileSync('qa/diagnostics.json', JSON.stringify(diagnostics, null, 2));

  if (errors.length > 0) {
    console.error("QA PASS FAILED:");
    console.error(errors.join('\n'));
    process.exit(1);
  } else {
    console.log("QA PASS COMPLETED SUCCESSFULLY!");
  }
})();
