> Archived release report. Current implementation and validation: [ESPORTS-REPORT.md](ESPORTS-REPORT.md).

# รายงานผล — Names, Birth Place, Tournament & Board (Save 11)

ตรวจและแก้จาก `Chess-Career-Mode-QoL-World-Circuit-UI.zip` ที่แนบในคำขอล่าสุด วันที่ 2026-11-08 ใช้ React/Vite และ dependencies จริงใน workspace ไม่มี React shim หรือแอปจำลองแทนโปรเจกต์

## สิ่งที่แก้ตามคำขอ

1. **ชื่อ NPC** — แยกชุดชื่อไทย/อินโดนีเซีย/มาเลเซีย/ฟิลิปปินส์ เพิ่มชุดเฉพาะประเทศอื่นและขยายชุดชื่อโลก กระจายความถี่ชื่อจริง/นามสกุล ตรวจชื่อเต็มซ้ำข้าม global/local/annual cohorts และตัดการแก้ชื่อซ้ำด้วยอักษรย่อ/Jr. อัปเกรด NPC เก่าโดยเก็บ ID, Elo, DOB, ความคืบหน้าและผลแข่ง ชื่อ Legends ไม่ถูกเปลี่ยน ข้อความข่าวเก่าแบบ free text เก็บไว้ตามเดิม
2. **Birth Place** — ตั้งประเทศ/เมืองเกิดแยกจากสัญชาติและเมืองที่อยู่ได้ตอนสร้างตัว แสดงใน Confirm/Profile และโปรไฟล์ NPC ไม่เปลี่ยนตามการย้ายสหพันธ์ เซฟเก่าใช้ career origin พร้อมระบุที่มา NPC สมมติมีสถานที่เกิดที่สร้างในเกม; Legends ที่ยังไม่มีข้อมูลอ้างอิงแสดง Not recorded
3. **เครื่องหมายบนกระดาน** — ไฮไลต์ช่องจาก/ถึงของหมากที่เลือกพร้อม `??` สีแดงเข้ม หรือ `!!` สีฟ้าอ่อน ใช้ judgment จาก engine; ย้ายตาม ply ที่เลือกและหายเมื่อย้อนถึงตำแหน่งเริ่มต้น Live labels เป็นผลประเมินเบื้องต้นเมื่อมีผลก่อน/หลังครบ; ผล review ภายหลังแทนที่ได้ Brilliant ต้องผ่านเงื่อนไข sacrifice, ทางเลือกที่สองและผลประเมิน ไม่สุ่มแจก
4. **ผู้สมัครทัวร์** — เพิ่มผู้สมัครตามวันในเกม ภายในช่วงสมัคร 35–63 วัน รายการยอดนิยมเต็มก่อน deadline ได้ ไม่มีที่นั่งรอผู้เล่นที่ยังไม่จ่ายเงิน ตรวจเต็ม/หมดเวลา/ซ้ำที่ core ด้วย รายการที่จ่ายแล้วกันที่นั่งไว้และล็อก planned roster; เริ่มจริงตามจำนวน NPC ที่มาถึงก่อนปิดรับ ส่วน inactive entrants ถูกตัดออกตอนเริ่ม เซฟเก่าที่จ่ายแล้วคง field เดิม
5. **ผู้จัด** — ทุก scheduled event มีชื่อ organizer กับ Official/Unofficial ในระบบ career รวมถึงหน้า current tournament ข้อมูลผู้จัดในเกมระบุ simulation แยกจากข้อเท็จจริง FIDE ที่อ้างอิง ไม่ได้อ้างว่าเป็นผู้จัดจริงของรายการอ้างอิงนั้น
6. **Find suitable tournaments** — ช่วงสัปดาห์เริ่ม, ช่วง Elo ขั้นต่ำที่รายการรับ, ทวีป, ช่วง participant limit และ Only events I can enter now ตรวจที่นั่ง/deadline/เงิน/คุณสมบัติ/ตารางชน ช่วง Elo นี้หมายถึงเกณฑ์รับสมัคร ไม่ใช่เรตเฉลี่ยคู่แข่ง
7. **Showmatch แบบเชิญ** — Next Generation Nations Showcase ปีละสองครั้ง สูงสุดห้าคนอายุไม่เกิน 25 ต่อประเทศ สูงสุด 50 ประเทศ จัดสิบรอบ Swiss เลือกจาก Elo และความแข็งแกร่ง delegation สมัครสาธารณะไม่ได้ ผู้ถูกเลือกใช้ Accept invitation รายชื่อที่ยอมรับถูกเก็บในเซฟ หน้า Home แสดง invitation หลังผ่าน selection จริง จำนวนจริงขึ้นกับ NPC ที่เข้าเกณฑ์ ไม่สร้างคนปลอมเพื่อบังคับให้ครบ 250
8. **หมากเหมือนกันข้าม OS** — ใช้ Cburnett SVG 12 ภาพที่ bundle ในโปรเจกต์กับทุกกระดาน, drag ghost, promotion และ player panel ไม่มี OS chess-font/emoji ในตัวหมาก รวม attribution/source/license ใน `public/pieces/cburnett/`

## ผลตรวจอัตโนมัติ

Environment: Node 24.22.1, npm 11.9.0, Chromium 156 บน cloud Linux ใช้ dependencies ที่มีอยู่แล้ว ไม่ได้รัน npm ci รอบใหม่ การติดตั้งใหม่ให้ใช้ package-lock.json และ npm ci ตาม README

| คำสั่ง | ผล | เวลาที่รันได้ที่นี่ |
|---|---|---:|
| `npm run test:ages` | PASS | 1.55 s |
| `npm run test:characters` | PASS | 0.27 s |
| `npm run test:chess-cache` | PASS | 0.23 s |
| `npm run test:circuit` | PASS | 0.88 s |
| `npm run test:complete` | PASS | 2.06 s |
| `npm run test:data` | PASS | 0.46 s |
| `npm run test:engine` | PASS | 0.26 s |
| `npm run test:expansion` | PASS | 0.95 s |
| `npm run test:match` | PASS | 139.55 s |
| `npm run test:play` | PASS | 5.16 s |
| `npm run test:qol` | PASS | 1.08 s |
| `npm run test:session` | PASS | 0.40 s |
| `npm run test:world` | PASS | 2.48 s |
| `npm run typecheck` | PASS | 9.20 s |
| `npm run build` | PASS | ดู `verification/circuit/build.log` |
| Browser suite ทั้งหมด | PASS 19/19 | ประมาณ 2.3 นาที |

ชุด browser ใช้ production build และทดสอบเกม/Stockfish จริง, built-in fallback, PGN, reload interruption, การจ่ายเงินสมัคร/แผน/สอดแนม, Swiss round, coach/federation/annual recruits, clock layout, history/replay, three save slots รวมกับสี่ scenario ใหม่

ตรวจซ้ำเฉพาะ circuit/expansion/mobile หลังแก้รูปแบบนามสกุลและข้อความสุดท้าย: ดู `verification/circuit/browser-final.log`

ตัวอย่างใหม่ที่ยืนยันได้: สร้างผู้เล่นสัญชาติไทยเกิด Kyoto/Japan และ reload; รายการ 32/32 ปิดสมัครและยังปิดหลัง reload; finder ใช้งานได้; รับ invitation แล้วเซฟสิบรอบ; คลิกหมาก blunder/brilliant แล้วย้าย marker ถูกช่องและล้างที่ Start; SVG ทั้ง 12 แบบโหลดครบและมี URL ชุดเดียวกันใน Android/iPhone emulation

## ตัวเลขประสิทธิภาพที่วัด

ชุดข้อมูลสังเคราะห์รวม NPC 4,321 คน (โลก 4,000 คน, Legends, local cohort และ annual cohort) กับ 163 รายการ ความเร็วต่อไปนี้เป็น Node/cloud ไม่ใช่เวลาของ Termux หรือการโหลดหน้าเว็บครบทุกขั้นตอน

| งาน | เวลาจากรอบบันทึก |
|---|---:|
| สร้างชุดโลก/identity ข้างต้น | 282.7 ms |
| อัปเกรดชื่อ/สถานที่เกิดของข้อมูลเก่า | 64.3 ms |
| คัดกรอง + นับที่นั่งทั้ง catalogue (cache อุ่น เฉลี่ย 100 รอบ) | 0.139 ms |

NPC ไทยในชุดทดสอบ 87 คน: ชื่อจริงต่างกัน 74 ชื่อ นามสกุลต่างกัน 83 นามสกุล ชื่อเต็มไม่ซ้ำทั้งชุด การใช้ชื่อจริง/นามสกุลเดียวกันบ้างยังเป็นไปได้เหมือนคนจริง

## ขอบเขตและการส่งต่อ

- ทดสอบ Android/iPhone ด้วย viewport, touch, device pixel ratio และ user-agent ใน Chromium ยังไม่ได้รันบน Safari/iPhone หรือ Termux จริง แต่รูปหมากใช้ SVG source เดียวกันโดยตรง ไม่พึ่ง glyph ของ OS
- ทัวร์/ผู้จัด/ผล career และ showmatches เป็นเกมสมมติ; FIDE references เดิมเป็น snapshot วันที่ 2026-11-08 ไม่ได้ดึงสดในรุ่นนี้
- Swiss engine เดิมและข้อจำกัดเดิมยังอยู่ ไม่อ้างว่าเป็น FIDE Dutch ที่ผ่านการรับรอง
- Build ผ่านพร้อมคำเตือน bundle ใหญ่กว่า 500 kB ของ Vite; ไม่ใช่ build error
- Save version 11 อัปเกรดอัตโนมัติและคงสามช่องเซฟ แนะนำทดแทน source ใน working directory ที่สะอาดและใช้ browser/origin เดิมหากต้องการเปิดเซฟในเครื่องเดิม
- รายงานเก่าอยู่ในแพ็กเพื่อเป็นประวัติ รุ่นปัจจุบันอ้างรายงานนี้กับ CHANGELOG และ `verification/circuit/`

ไฟล์ส่งมอบ: `Chess-Career-Mode-Names-Birthplace-Tournaments-Board.zip` โฟลเดอร์ด้านใน `Chess-Career-Mode/` ไม่รวม node_modules/dist/.git หรือ browser trace ชั่วคราว มี source, package-lock, public assets, รายงาน, raw logs และภาพตรวจ UI รุ่นนี้
