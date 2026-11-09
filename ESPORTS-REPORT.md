# รายงานผล — Multi-Day Tournaments & Esports

วันที่ 2026-11-08 · Save version 12

ต่อจาก ZIP `Chess-Career-Mode-Names-Birthplace-Tournaments-Board.zip` ที่แนบในคำขอล่าสุด ใช้โปรเจกต์และ dependencies จริง ไม่มี React shim หรือเว็บจำลองแทนแอป

## ผลตามคำขอ

| รายการ | สิ่งที่ใช้งานได้ |
|---|---|
| Official / Unofficial | เพิ่มใน Find suitable tournaments และตัวกรอง Esports |
| หลายวัน | เพิ่มสามรายการต่อเดือน หรือ 36 รายการต่อปี เริ่มวันที่ 3, 12, 21: 3-day RR, 7-day RR และ 7-day BO3 |
| พบทุกคน | Single round robin พบทุกคู่หนึ่งเกม BO3 พบทุกคู่แบบ 2–3 เกม เกมสามถูกข้ามเมื่อจบ 2–0 และสลับสีในเกมสอง |
| ตารางรายวัน | แสดง maximum games ต่อผู้เล่น, วันพัก และช่วง HH:MM; จำนวนจริงลดได้จากบาย/การ clinch BO3 |
| ปฏิทินจริง | วันถัดไปต้องใช้ Advance to next match day ไม่สามารถส่งผลเกมอนาคตได้ พัก/AP/fatigue และวันที่เลื่อนจริง |
| Single day | รายการ rapid/blitz เดิมยังอยู่ พร้อม daily games & times; รายการ classical ที่ยาวแบ่ง itinerary ตามเวลาที่ต้องใช้ |
| ชื่อ Organizer | ตัด suffix `(career simulation)` ออก |
| Circuit แยก | Complete → Tournament สลับ Chess tournaments / Esports; ยังมีเมนูหลักเดิมหกเมนู |
| Tier | D 1800–2000, C 2001–2200, B 2201–2500, A 2501–2699, S 2700+; ค่าเฉลี่ยทีมปัดเป็น Elo จำนวนเต็มให้ตรงกับ UI |
| Free Agent | ลง D qualifier ด้วยทีมเฉพาะกิจได้ รอข้อเสนอรายสัปดาห์ หรือสร้างทีมเอง |
| ข้อเสนอจากทีม | ใช้ Elo, ทักษะ, ฟอร์ม และจำนวนเกม; ทีมระดับยักษ์มีโอกาสไม่เกิน 0.8% ต่อทีมต่อสัปดาห์เมื่อผ่านเกณฑ์ ไม่สุ่มใหม่จากการรีโหลด |
| สร้างทีม | Duo/Trio ราคา $100 ชวน NPC ซึ่งรับหรือปฏิเสธได้ รอ 14 วันก่อนชวนคนเดิมใหม่ แก้ roster ต้องไม่มี booking/event ค้าง |
| สัญญา | 12 สัปดาห์ เงินเดือนจ่ายตามงวดครั้งเดียว สัญญาหมดกลับเป็น Free Agent |
| รายการ Esports | Weekly, Qualifier, Monthly; top two qualifier ให้ pass Tier เดิม 42 วันเพื่อสมัคร Monthly |
| แข่งเป็นทีม | สี่ทีม round robin สาม fixtures ผู้เล่นลงหนึ่งกระดานต่อ fixture ส่วนเพื่อนร่วมทีมลงกระดานคู่ขนาน Duo สองกระดาน Trio สามกระดาน |
| เกมจริง/ผลทีม | กระดานผู้เล่นใช้ MatchSession/engine/referee จริง; กระดาน NPC จำลองด้วย Elo รวม match points และ board points เก็บผลทีมกับเกมจริง |
| ฟอร์ม/รางวัล | ทีมชนะ fixture ได้ 3 เสมอ 1; เงินทีมแบ่งเท่ากันตามขนาดทีม ส่วนของผู้เล่นเข้าเงิน/ledger ครั้งเดียว |
| เลือกเส้นทางหลัก | Traditional / Esports / Mixed เป็นความชอบที่บันทึกไว้ ไม่มีการล็อกอีกเส้นทาง ใช้ Elo และวันที่ร่วมกัน แต่ bookings/current team event/history แยกกัน |

## การป้องกันข้อผิดพลาดที่ตรวจ

- ตรวจวันชนข้ามสอง circuits ทั้งตอนสมัครและเริ่มงาน การ simulate วันพร้อมแผนฝึกหยุดที่ booking ใกล้ที่สุดทั้งสองระบบ
- ตรวจเงิน/roster/tier/deadline และไม่รับรายการซ้ำ ไม่รับผลซ้ำหรือผลจาก round/opponent ที่ไม่ตรง
- ตรวจ Elo ผู้เล่นและทีมซ้ำในวันเริ่ม ถ้า Elo เปลี่ยนจนออกนอก Tier ยกเลิก entry และคืนค่าธรรมเนียม ป้องกันจองรายการต่ำไว้ฟาร์มรางวัลเมื่อเก่งขึ้นแล้ว
- กรณีจ่ายค่าสมัครจริงแล้วเลื่อน Tier ถูกทดสอบว่าคืนเงินครบ และกด Start ซ้ำไม่ได้เงินคืนเพิ่ม
- ป้องกัน End day ระหว่าง match ที่ยังทำงาน และแจ้งก่อนข้ามวันที่มีเกมค้าง เกมที่ข้ามวันถูก forfeit ตามกติกา
- Pending checkpoint เก่าของ round ที่เสร็จแล้วไม่ทำให้ Elo/ผลแข่ง/เงินเพิ่มซ้ำ การกู้เกม Esports ที่เดินไปแล้วบันทึก abandoned/loss ครั้งเดียว
- การจ่ายเงินเดือนตาม paid-week marker, ข้อเสนอที่เช็กแล้วในสัปดาห์นั้น และ recruitment cooldown ถูกบันทึกในเซฟ
- เก็บประวัติทีมแบบมีขอบเขต ไม่ทำซ้ำ NPC ใน field เดียวกัน ใช้ population lookup/count cache ตาม array identity และสร้าง recruit market เฉพาะเวลาที่เปิดหน้า team owner

## ผลทดสอบ

Environment: Node 24.22.1, npm 11.9.0, Chromium 156 บน cloud Linux ใช้ dependencies ที่ติดตั้งอยู่ใน workspace ตาม lockfile ไม่ได้ติดตั้งแพ็กเกจใหม่รอบนี้

| คำสั่ง | ผล |
|---|---|
| `npm run test:ages` | PASS |
| `npm run test:characters` | PASS |
| `npm run test:chess-cache` | PASS |
| `npm run test:circuit` | PASS |
| `npm run test:complete` | PASS |
| `npm run test:data` | PASS |
| `npm run test:engine` | PASS |
| `npm run test:esports` | PASS |
| `npm run test:expansion` | PASS |
| `npm run test:match` | PASS |
| `npm run test:play` | PASS |
| `npm run test:qol` | PASS |
| `npm run test:session` | PASS |
| `npm run test:world` | PASS |
| `npm run typecheck` | PASS |
| `npm run build` | PASS |
| Production browser suite | PASS 22/22 |
| ตรวจเฉพาะ Complete + Esports หลัง tier guard | PASS 6/6 |
| Smoke test Esports บน release build รอบสุดท้าย | PASS 3/3 |

Raw logs อยู่ใน `verification/esports/` โดย `browser.log` เป็นชุดเต็ม และ `browser-final.log` เป็นการตรวจซ้ำเฉพาะส่วนที่เปลี่ยน และ `browser-release.log` เป็น smoke test รอบส่งมอบ

ชุดใหม่ test:esports ตรวจ: 36 rotations / 12 เดือน, RR ทุกคู่, BO3 clinch/tied-series decider, exact-date entry, future-day rejection, ทุกขอบ Tier, การปัด Elo ทีม, unique squads, two-way booking conflicts, refunds/prize idempotency, NPC refusal/cooldown, rare offers, salary/expiry, migration, persistence, actual store match progression/recovery และทัวร์ 7 วันที่ทำให้ปฏิทินเลื่อนจริง 6 วันหลังวันเริ่มพร้อมฟื้น AP

Browser ใหม่สาม scenario ใช้ UI จริง: ตัวค้นหาผู้จัด/3–7 วันและวันเริ่มจริง; Free Agent qualifier ที่จำลองเกมด้วย engine แล้ว take control/resign, เก็บผลแยกและ reload; สร้าง Trio, รับ/ปฏิเสธคำชวน, เซฟ roster/focus และกลับไปเล่นทัวร์ปกติได้ ชุดเดิมยังตรวจ Stockfish จริง, built-in fallback, PGN, 3 save slots, SVG/annotation, federation, coaching, annual NPCs, Swiss, history/replay และ mobile layout

`test:match` ตรวจ referee กับ chess.js 23,059 ตำแหน่งและเล่นเกม engine จนจบ ใช้เวลาหลายนาที ไม่ได้ลดจำนวนเกม/ความครอบคลุมเพื่อให้ผ่าน ชุด test เก่าบางจุดถูกปรับ fixture ให้เลือก Swiss ที่ยังมีที่ว่าง, คิดค่าเดินทางด้วย และย้ายไปวันเริ่มที่ถูกต้อง แทนสมมติว่าทุก event เริ่มวันแรกของสัปดาห์

## ขอบเขตที่ควรทราบ

- HH:MM ใหม่เป็น **ตารางเวลาทัวร์ในเกม** แยกจากนาฬิกาหมากรุกที่นับจริงของแต่ละเกม ไม่ใช่นาฬิกาโลกที่เพิ่มเข้าหน้า Home/กิจกรรมทั่วไป
- BO3 ที่เสมอหลังสามเกมใช้ rapid decider ที่จำลองจาก Elo แสดง tiebreak winner โดยไม่สร้าง PGN ปลอมของ decider
- กระดานเพื่อนร่วมทีม/NPC ใช้ผลจำลองตามเรต ไม่ได้รัน engine เต็มเกมทุกกระดาน ส่วนกระดานผู้เล่นเล่นจริง/วิเคราะห์/รีเพลย์ได้ตามระบบเดิม
- Save 12 อัปเกรดจากเซฟเก่าอัตโนมัติ NPC IDs, Elo, ผลแข่ง, ชื่อ/สถานที่เกิด, SVG และเซฟสามช่องเดิมยังอยู่
- ทุกชื่อทีมและรายการ Esports ใหม่เป็นชื่อสมมติที่ใช้รูปแบบหมวด [Liquipedia](https://liquipedia.net/chess/Portal:Tournaments) เป็นแนวทาง ไม่ใช่ผล/ตารางแข่งจริง ช่วง Elo เป็นเกณฑ์ตามคำขอ ไม่ใช่นโยบายจัด Tier ของ Liquipedia
- การเปิดหน้าหมวดบาง URL โดยตรงได้ HTTP 403 จึงใช้ข้อมูลหมวด/ตัวอย่างที่ค้นอ่านได้เป็นแนวทาง และไม่อ้างว่าดึงชื่อหรือผลจริงครบทุกหน้า ลิงก์ทั้งเก้าหมวดอยู่ใน ESPORTS-GUIDE.md และใน UI
- Swiss เดิมยังเป็น custom Swiss ไม่อ้างว่าได้รับรองเป็น FIDE Dutch
- Build ผ่านพร้อมคำเตือน bundle ใหญ่กว่า 500 kB ของ Vite ยังไม่ได้วัด FPS หรือเวลาใช้งานบน Termux/iOS Safari จริง การตรวจมือถือเป็น Chromium emulation

## ไฟล์ส่งมอบ

`Chess-Career-Mode-Multi-Day-Tournaments-Esports.zip` มีโฟลเดอร์ `Chess-Career-Mode/` พร้อม source, package-lock, public assets, CHANGELOG, คู่มือ, รายงานและ raw logs ไม่รวม node_modules/dist/.git และ browser traces ชั่วคราว รายงานเก่าเก็บไว้เป็น archive ให้ใช้รายงานนี้สำหรับรุ่นปัจจุบัน
