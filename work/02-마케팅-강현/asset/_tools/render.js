// usage: node render.js <html file> <out dir> [prefix]
// renders every .slide element to <prefix>NN.png at its CSS pixel size (scale 1)
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const [file, outDir, prefix = ''] = process.argv.slice(2);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 1400 }, deviceScaleFactor: 1 });
  await p.goto('file://' + path.resolve(file));
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(300);
  const slides = await p.$$('.slide');
  for (let i = 0; i < slides.length; i++) {
    const n = String(i + 1).padStart(2, '0');
    await slides[i].screenshot({ path: path.join(outDir, `${prefix}${n}.png`) });
  }
  console.log(`${file}: ${slides.length} slides`);
  await b.close();
})();
