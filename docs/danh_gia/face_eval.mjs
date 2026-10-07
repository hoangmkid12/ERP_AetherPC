// Đánh giá bộ so khớp khuôn mặt của hệ thống (face-api 1.7.15, TinyFaceDetector 160/224/320 ngưỡng 0,4, vector 128 chiều,
// khoảng cách Euclid) trên bộ ảnh công khai LFW. Mô phỏng đúng quy trình: mẫu đăng ký = trung bình 4 ảnh; mỗi lần chấm công
// = 1 ảnh còn lại, chấp nhận khi khoảng cách tới mẫu <= ngưỡng.
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const ROOT = process.argv[2];
const PEOPLE = 100, PER = 8, ENROLL = 4;
const persons = fs.readdirSync(ROOT).filter(p => fs.statSync(path.join(ROOT, p)).isDirectory())
  .map(p => ({ p, imgs: fs.readdirSync(path.join(ROOT, p)).filter(f => f.endsWith('.jpg')).sort() }))
  .filter(x => x.imgs.length >= PER).sort((a, b) => a.p.localeCompare(b.p)).slice(0, PEOPLE);
console.log('persons', persons.length);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.route('http://lfw.local/**', r => r.fulfill({ path: path.join(ROOT, decodeURIComponent(new URL(r.request().url()).pathname.slice(1))), contentType: 'image/jpeg' }));
await page.route('http://app.local/', r => r.fulfill({ contentType: 'text/html', body: '<html><body></body></html>' }));
await page.goto('http://app.local/');
await page.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/dist/face-api.js' });
await page.evaluate(async () => {
  const M = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model/';
  await faceapi.nets.tinyFaceDetector.loadFromUri(M);
  await faceapi.nets.faceLandmark68Net.loadFromUri(M);
  await faceapi.nets.faceRecognitionNet.loadFromUri(M);
});
const desc = {};
let miss = 0;
for (const { p, imgs } of persons) {
  desc[p] = [];
  for (const f of imgs.slice(0, PER)) {
    const d = await page.evaluate(async (src) => {
      const img = new Image(); img.crossOrigin = 'anonymous'; img.src = src; await img.decode();
      for (const inputSize of [160, 224, 320]) {
        const r = await faceapi.detectAllFaces(img, new faceapi.TinyFaceDetectorOptions({ inputSize, scoreThreshold: 0.4 })).withFaceLandmarks().withFaceDescriptors();
        if (r.length) { r.sort((a, b) => b.detection.box.area - a.detection.box.area); return Array.from(r[0].descriptor); }
      }
      return null;
    }, `http://lfw.local/${encodeURIComponent(p)}/${encodeURIComponent(f)}`);
    if (d) desc[p].push(d); else miss++;
  }
}
await browser.close();

const dist = (a, b) => Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));
const mean = arr => arr[0].map((_, i) => arr.reduce((s, v) => s + v[i], 0) / arr.length);
const tpl = {}, probes = [];
for (const p of Object.keys(desc)) {
  if (desc[p].length < ENROLL + 1) continue;
  tpl[p] = mean(desc[p].slice(0, ENROLL));
  for (const d of desc[p].slice(ENROLL)) probes.push([p, d]);
}
const genuine = [], impostor = [];
for (const [p, d] of probes) for (const q of Object.keys(tpl)) (q === p ? genuine : impostor).push(dist(d, tpl[q]));
const rate = (arr, f) => arr.filter(f).length / arr.length;
const rows = [0.40, 0.45, 0.50, 0.55, 0.60].map(t => ({ t, FAR: rate(impostor, x => x <= t), FRR: rate(genuine, x => x > t) }));
let eer = null;
for (let t = 0.3; t <= 0.8; t += 0.001) { const far = rate(impostor, x => x <= t), frr = rate(genuine, x => x > t); if (far >= frr) { eer = { t: +t.toFixed(3), far, frr }; break; } }
const stat = a => { const s = [...a].sort((x, y) => x - y); return { mean: s.reduce((x, y) => x + y, 0) / s.length, p5: s[Math.floor(s.length * 0.05)], p95: s[Math.floor(s.length * 0.95)] }; };
const out = { persons: Object.keys(tpl).length, images: persons.length * PER, notDetected: miss, genuinePairs: genuine.length, impostorPairs: impostor.length,
  genuine: stat(genuine), impostor: stat(impostor), rows, eer };
console.log(JSON.stringify(out, null, 1));
fs.writeFileSync(process.argv[3], JSON.stringify(out, null, 1));
