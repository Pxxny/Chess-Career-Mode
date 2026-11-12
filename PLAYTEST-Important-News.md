# Playtest — Important News และไลบรารี UI

ทดสอบบน production build ใน Chromium / Node 24 วันที่ 12 พฤศจิกายน 2026

## ตรวจอะไรบ้าง

- สร้างรายการทีมชาติที่ลงทะเบียนและคัดตัวจริงจาก NPC world จริงใน fixture เริ่ม Simulate Season แล้วตรวจว่าขึ้นข่าวก่อนเริ่มรายการ วัน/AP/ผลการแข่งขันยังไม่ถูกเดินต่อ โหลดหน้าใหม่ยังมีข่าวเดิมหนึ่งครั้ง อ่านแล้วโหลดใหม่ไม่เด้งซ้ำ และ Resume ลงผลทีมชาติครั้งเดียว
- ใช้ fixture ผลทัวร์นาเมนต์ชนะเพื่อเปิดหน้าข่าว ตรวจภาพ SVG โหลดได้ หัวข้อ/เนื้อหา ภาษาไทย หน้าข่าวย้อนหลัง การปิดด้วย Escape และ Drawer มือถือที่ 390px/320px
- ปฏิทิน FullCalendar เปิดรายการที่มีจริงในเดือน แล้วเปิดหน้ารายละเอียดเดิมได้ ตรวจทั้งเดสก์ท็อปและมือถือ พร้อมทดสอบไฟล์สำรองและ Sonner
- สร้างอาชีพใหม่เพื่อทดสอบ React Joyride โดยไม่ได้ปิดบทสอนไว้ใน fixture ทดสอบทั้งปุ่มปิดและ “Do not show again” ว่า localStorage ถูกบันทึก ไม่แสดงอีกหลัง reload และหลังสร้างตัวละครที่สอง
- ทดสอบร่วมกับเกมจริง Stockfish/fallback การวิเคราะห์ PGN การโหลดกลับ เกม Swiss/ทีมชาติ กราฟ Elo และการจำลองครบปีที่อ่านและกด Continue ทุกข่าวสำคัญอย่างชัดเจน

ภาพชุดนี้ใช้ fixture เพื่อให้เข้าถึงเหตุการณ์สำคัญได้แน่นอน ส่วนการจำลองเต็มปีใน `test:simulate-season` ใช้เกมจริงและได้ 164 เกม ตรวจ SAN/UCI, Opening, clocks, PGN, backup และ deterministic pause/resume ผ่าน โดยกดรับทราบข่าวสำคัญใน harness ก่อนทำต่อ

## ผลตรวจ

ผล browser แบบละเอียด: [browser-results.json](verification/important-news/browser-results.json)

- `npm run build`: ผ่าน TypeScript และ production build
- `npm run test:important-news`: ผ่านการตรวจหยุดตรงขอบเขตกิจกรรม แชมป์/ทีมชาติ/ตำแหน่ง/สิทธิ์แข่งขัน การไม่แจ้งเรื่องทั่วไป การเก็บคิวข่าว/ไม่ซ้ำหลัง reload และ backup/Zod
- `npm run test:simulate-season`: ผ่านฤดูกาลจริง 364 วัน 164 เกม พร้อมอ่านและทำต่อเมื่อมีข่าว
- `test:ui-learning-elo`, `test:language`, `test:backup-lifetime`, `test:roadmap`: ผ่าน
- Browser ที่เกี่ยวข้อง **18 กรณีผ่าน**: app 4, Complete 3, ข่าว/ปฏิทิน/Joyride/ลำดับข่าวก่อนสรุปปี 6, mobile 1, UI/Elo/Wake Lock 4 รวมผลล่าสุดต่อกรณีจากรอบหลักและตรวจซ้ำ ไม่ใช่การรันครบทุกไฟล์ในโปรเจกต์
- ปรับ assertion ของ Candidates ให้รองรับทั้ง “ยังไม่เปิดรับสมัคร” และ “ไม่เข้าเกณฑ์” ตามช่วงปฏิทิน โดยต้องสมัครไม่ได้ทั้งสองกรณี
- รอบ Learning Season ผ่าน **364 วัน / 63 เกม / 1,080 ครั้งฝึก** และกราฟทุกช่วงตรงกับเซฟ รอบนี้ไม่มีเหตุการณ์ระดับข่าวสำคัญ จึงไม่มีการขัดจังหวะอัตโนมัติจากการฝึกหรือเงิน ส่วนกรณีข่าวสำคัญใช้ fixture และตรวจผ่านการหยุดจริงในตัวจำลอง ข้อมูลรอบปีอยู่ใน [full-season-news.json](verification/important-news/full-season-news.json)

## ภาพหน้าจอ

[เปิดแกลเลอรี 9 ภาพ](artifacts/important-news/index.html)

- [ข่าวติดทีมชาติ ก่อนเริ่มแข่ง](artifacts/important-news/01-national-callup-desktop.png)
- [ข่าวแชมป์บนมือถือ](artifacts/important-news/02-victory-mobile-en.png)
- [อ่านข่าวย้อนหลังภาษาไทย](artifacts/important-news/03-victory-mobile-th.png)
- [ห้องข่าวบนจอ 320px](artifacts/important-news/04-newsroom-small-mobile-th.png)
- [ปฏิทินรายการแข่งแบบเดือน](artifacts/important-news/05-fullcalendar-desktop.png)
- [ปฏิทินบนมือถือ](artifacts/important-news/06-fullcalendar-mobile.png)
- [แจ้งผลการสำรองด้วย Sonner](artifacts/important-news/07-backup-toast.png)
- [React Joyride · ปิดบทสอน](artifacts/important-news/08-first-run-tour-close.png)
- [React Joyride · ไม่ต้องแสดงอีก](artifacts/important-news/08-first-run-tour-skip.png)

## ไลบรารีและรุ่น

รุ่นจริงที่ล็อกไว้ใน [library-versions.json](verification/important-news/library-versions.json) การใช้งานแต่ละตัวอยู่ใน README ใบอนุญาตอยู่ใน `public/licenses/UI-LIBRARIES-NOTICES.txt` FullCalendar ใช้ชุด core/react/plugins รุ่น 6.1.19 เดียวกัน และ TanStack Table ใช้รุ่น 8 ที่เข้ากับ API ของ React 18 ในโปรเจกต์

## รันซ้ำ

```bash
npm ci
npm run build
npm run test:important-news
CHROMIUM_PATH=/usr/bin/chromium npx playwright test tests/important-news.spec.ts --reporter=list
npm run test:simulate-season
```

ถ้าใช้ Chromium ของ Playwright เอง ให้ติดตั้งด้วย `npx playwright install chromium` แล้วไม่ต้องตั้ง `CHROMIUM_PATH` คำสั่ง `test:important-news` เตรียม backup fixture ใน `/tmp` ให้ browser test ไฟล์ fixture ชั่วคราวเหล่านั้นไม่รวมใน ZIP ส่งมอบ

การปิด Joyride จำไว้ในเบราว์เซอร์เดิมทุกตัวละคร ไม่ใช่บัญชีออนไลน์ การล้างข้อมูลเว็บไซต์หรือบล็อกการเก็บข้อมูลอาจทำให้เบราว์เซอร์ไม่สามารถจำข้ามการเปิดใหม่ได้
