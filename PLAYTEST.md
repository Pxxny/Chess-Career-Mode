# Playtest — UI, Wake Lock, Learning Focus และ Elo Charts

รายงานนี้เป็นรอบ UI/Elo ก่อนเพิ่มระบบข่าว ดูผลรุ่นล่าสุดที่ [PLAYTEST-Important-News.md](PLAYTEST-Important-News.md)

ทดสอบวันที่ 12 พฤศจิกายน 2026 ด้วย Node 24 / Chromium ในสภาพแวดล้อม Cloud ใช้ตัวละครทดสอบที่สร้างผ่าน UI และฐานข้อมูล Small

## ผลตรวจ

- `npm run build` ผ่าน TypeScript และ production build; Chart.js แยกเป็นไฟล์โหลดเมื่อเปิด Stats (158.69 kB / gzip 56.19 kB)
- Browser tests ที่เกี่ยวข้อง **14 กรณีผ่าน** (รวมผลรอบตรวจและรอบแก้ fixture/ตัวเลือกเมนู): app 4, Complete 3, mobile 1, UI/Learning/Elo/Wake Lock 4, pause/reload และปลายฤดูกาล 2 ไม่ได้รันทั้งชุด 81 กรณี
- `test:ui-learning-elo`, `test:simulate-season`, `test:language`, `test:backup-lifetime` และ `test:roadmap` ผ่าน
- Learning Season เลือกช่องเปิด + ท้ายเกม จำลองครบ **364 วัน / 59 เกม / 1056 ครั้งฝึก** พัก โหลดใหม่ แล้วทำต่อได้โดยเก็บโฟกัสเดิม ไม่มี JavaScript page error ตรวจกราฟรายเดือน 9 จุด รายทัวร์นาเมนต์ 9 จุด และรายปี เทียบค่าทุกจุดกับเซฟจริง
- ตรวจ layout 1440px, 390px, 320px และกระดาน/รายละเอียดช่องเปิดเดิมที่ 320px, 390px, 768px ไม่มีหน้าล้นแนวนอน ตรวจเมนู More sections, การเปิดส่วนพับเก็บ และเล่น e2–e4 ให้คู่แข่งตอบจริง
- ตรวจเกมจริง/Stockfish/วิเคราะห์/PGN/การโหลดเกม และ fallback เมื่อไม่มี Stockfish ทดสอบทะเบียน/เตรียมตัว/การแข่งขันบุคคลและทีมชาติด้วย fixture ที่อยู่ในช่วงเปิดรับสมัคร
- การตรวจ Season แบบ Node เดิมเล่น **164 เกม** เก็บ Replay, SAN/UCI, clocks/increment, Opening/ECO, PGN ที่โหลดกลับได้ และ backup ครบ **164 เกม** รวมข้อมูลเกินแคช 60 เกม พร้อมตรวจพัก/โหลด/ไม่ลงผลซ้ำ
- ตรวจ lifetime 1,104 เกมเกินขีดจำกัดประวัติ และตรวจเซฟเก่า/backup checksum โดยไม่มีการล้างข้อมูล

## Screen Wake Lock

Chromium ที่ `http://127.0.0.1` รับคำขอจริง (`supported: true`, `status: active`) พร้อมเก็บผลใน `verification/ui-learning-elo/native-browser-results.json` ทดสอบการปล่อยล็อกเมื่อซ่อนแท็บ/ออกจากอาชีพ ขอใหม่เมื่อกลับมา ระบบปล่อยล็อกเอง กรณีไม่รองรับ และกรณีปฏิเสธ ด้วย API mock ที่ควบคุมเหตุการณ์ได้

ไม่ได้วัดหน้าจอจริงหลังเวลาปิดจอของเครื่อง เพราะเบราว์เซอร์ทดสอบทำงานแบบ headless การทำงานบนเครื่องผู้เล่นยังขึ้นกับ HTTPS/localhost การรองรับเบราว์เซอร์ และนโยบายประหยัดพลังงานของระบบ

## ภาพหน้าจอ

[เปิดแกลเลอรี 13 ภาพ](artifacts/ui-learning-elo/index.html)

- [หน้า Home บนเดสก์ท็อป](artifacts/ui-learning-elo/01-home-desktop-en.png)
- [เลือกโฟกัส Learning Season](artifacts/ui-learning-elo/02-learning-options-en.png)
- [Learning Season ภาษาไทยบนมือถือ](artifacts/ui-learning-elo/03-learning-options-mobile-th.png)
- [ขณะจำลองฤดูกาล](artifacts/ui-learning-elo/04-season-progress.png)
- [สรุปเมื่อเล่นครบปี](artifacts/ui-learning-elo/05-year-review.png)
- [กราฟ Elo รายเดือน](artifacts/ui-learning-elo/06-elo-month-desktop-en.png)
- [กราฟ Elo รายทัวร์นาเมนต์](artifacts/ui-learning-elo/07-elo-tournament-desktop-en.png)
- [กราฟ Elo รายปี](artifacts/ui-learning-elo/08-elo-year-desktop-en.png)
- [กราฟ Elo ภาษาไทย · 390px](artifacts/ui-learning-elo/09-elo-month-mobile-th.png)
- [หน้า Home บนมือถือ](artifacts/ui-learning-elo/10-home-mobile-en.png)
- [ลดแท็บย่อยใน Career](artifacts/ui-learning-elo/11-career-more-mobile-en.png)
- [เล่นหมากรุกจริงบนมือถือ](artifacts/ui-learning-elo/12-live-game-mobile-th.png)
- [กราฟบนจอเล็ก · 320px](artifacts/ui-learning-elo/13-elo-month-small-mobile-th.png)

## รันซ้ำ

```bash
npm ci
npm run build
npm run test:ui-learning-elo
npm run test:simulate-season
CHROMIUM_PATH=/usr/bin/chromium npx playwright test tests/ui-learning-elo.spec.ts tests/app.spec.ts tests/mobile.spec.ts tests/complete.spec.ts
CHROMIUM_PATH=/usr/bin/chromium npx playwright test tests/simulate-season.spec.ts --grep 'pause, reload|mobile Thai'
```

หากไม่ได้ใช้ Chromium ของระบบ ติดตั้งเบราว์เซอร์สำหรับ Playwright ด้วย `npx playwright install chromium` แล้วไม่ต้องกำหนด `CHROMIUM_PATH` สำหรับ Windows ตั้ง environment variable ตาม shell ที่ใช้

การทดสอบ UI จะเขียนอาชีพทดสอบไว้ชั่วคราวที่ `/tmp/chess-ui-learning-storage.json` ไม่รวมไฟล์นี้ในแพ็กที่ส่ง หากต้องการเก็บภาพกราฟและกระดานแบบเจาะจงเพิ่ม ให้เปิด `npm run preview -- --host 127.0.0.1 --port 4173` แล้วรัน `node scripts/capture-ui-playtest.mjs`

ปรับ test navigation ให้เลือกมุมมองผ่านเมนูเพิ่มเติม/เปิดจัดการเซฟก่อนใช้งาน และกัน service worker ในกรณีทดสอบตัดเครือข่าย Stockfish เพื่อให้ตรวจ fallback ได้จริง
