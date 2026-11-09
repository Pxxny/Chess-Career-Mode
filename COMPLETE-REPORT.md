> Archived release report. Current implementation and validation: [ESPORTS-REPORT.md](ESPORTS-REPORT.md).

# Chess Career Mode — Complete: Tournament, Swiss, Prepare

วันที่ตรวจ: 2026-11-08 · Save version 9

## สิ่งที่ส่งมอบ

Complete มี 6 เมนู: **Tournament, Swiss, Prepare, Rankings, League, History**

พัฒนา Tournament, Swiss และ Prepare ในรุ่นนี้ ส่วน Rankings ใช้รายชื่อ/อันดับ NPC เดิม และ League แสดงระดับลีกตามเรตติ้งเดิม ไม่ได้เพิ่มระบบฤดูกาลลีกใหม่ในรอบนี้

- **Tournament:** หน้ารายการปัจจุบัน แสดงสถานที่/ประเทศ ประเภท เวลาแข่งขัน รอบ อันดับโลกและอันดับในรายการ คู่ถัดไป ตารางคะแนน ประวัติจับคู่ เงินรางวัล เงื่อนไข และสถานะสมัคร พร้อมปฏิทินล่วงหน้า 52 สัปดาห์ที่ค้นหาและกรองได้
- การ์ดรายการแสดงวันเริ่ม/จบ วันปิดรับสมัคร ค่าสมัคร Elo จำนวนผู้เล่นสูงสุด จำนวนรอบ รูปแบบ เงินรางวัล Prestige และเงื่อนไขคัดเลือก
- ลงทะเบียนก่อนเล่นจริง ป้องกันสมัครซ้ำ กดซ้ำ เส้นตายที่ส่งมาจากหน้าจอเก่า และสมัครหลายรายการที่เริ่มสัปดาห์เดียวกัน ตรวจ Elo, reputation, title, qualification, nationality, league และสมาชิก Federation ตามรายการ หักค่าสมัครครั้งเดียว ยกเลิกก่อนสัปดาห์แข่งได้คืนเงิน
- มีครบ 12 ประเภทที่ขอ: World Championship, Candidates, Olympiad, World Cup, Grand Swiss, Continental, National, Open, Invitational, Classical Super, Rapid, Blitz และรายการสมมติ
- ใช้ Swiss, single/double round-robin, championship match และ knockout จริงตามประเภทที่ระบุ Championship จบเมื่อคะแนนขาด; knockout ที่เสมอใช้ rapid tiebreak แบบจำลองซึ่งไม่ได้เพิ่มผล rated classical อีกเกม
- **Swiss:** มี NPC คะแนน อันดับ คู่ปัจจุบัน/ย้อนหลัง และ tiebreaks ใช้ maximum matching เพื่อไม่จับคู่ซ้ำถ้ายังมีการจับคู่ครบชุดที่ไม่ซ้ำได้ พร้อมความสำคัญของ score group, สีหมาก และ bye แก้กรณี greedy จับแล้วตัน
- **Prepare:** มี Preparation, Scout Opponent, Game Plan, Repertoire การตั้งค่าเป็น draft; ต้องจ่ายเตรียมตัวก่อนจึงนำ snapshot นั้นไปใช้ในรายการที่เลือก การแก้ draft ภายหลังไม่ให้ผลฟรี
- Approach ทั้งห้าปรับความชอบในการเลือกหมากของ simulator จาก candidate ที่ยังเหมาะสม ไม่เพิ่มเรตติ้งหรือรับประกันชัยชนะ
- Cloud usage เป็นชื่อกลุ่มตัวเลือกในเกม ใช้การคำนวณในเครื่อง ไม่มีการเรียกบริการ cloud ภายนอก
- White/Black repertoire, responses ต่อ e4/d4/c4/Nf3 และ backups ใช้ SAN opening lines จริง คำตอบเฉพาะมีลำดับก่อน Black repertoire ทั่วไป และใช้ backup เมื่อเส้นหลักไม่ตรงกับตำแหน่ง
- Scout มี Elo/style สาธารณะ และรายงานที่ปลดล็อก favorite openings, form/morale, strengths/weaknesses และเกมที่เคยเล่นกับผู้เล่นจริง ไม่สร้างประวัติผลการแข่งขันปลอม
- Early Draw ใช้กับเกมจำลองในรายการ: อย่างน้อย 20 half-moves, evaluation ภายใน ±25 cp, คู่แข่งไม่ stubborn และผู้เล่นนำ/นำร่วมในสองรอบสุดท้าย เกมที่เล่นเองยังใช้ปุ่มขอเสมอเดิม
- เก็บรายการจบแล้ว 30 รายการพร้อม standings/pairings ใน History ได้ qualification ตามผลงานที่กำหนด ใช้ได้ถึงอีกสองปีปฏิทิน การถอนตัวหรือเลยสัปดาห์สิ้นสุดไม่ได้รางวัล/qualification และรอบค้างถูกปรับแพ้
- ป้องกันเปิดเกมใหม่ซ้อนกับ simulation ของตัวละครเดียวกันที่ยังรันเบื้องหลัง ป้องกันผลรอบเก่าถูกส่งซ้ำ และผูก callback/analysis/checkpoint กับ career เดิมเพื่อไม่เขียนข้าม save slot
- คงระบบ Look, Legends, NPC รายปี, วันเกิด, 3 save slots, Federation และ Coach เดิม ย้ายไปอยู่เมนูย่อยที่เกี่ยวข้อง

## ต้นทุนการเตรียมตัว

| โหมด | AP | เงิน | ชั่วโมงในเกม | ความลึก opening | เวลา search/คิดหมากเทียบปกติ |
|---|---:|---:|---:|---:|---:|
| Play Fast | 1 | $10 | 1 | 4 half-moves | 0.65× |
| Normal | 2 | $20 | 2 | 8 half-moves | 1× |
| Think Deeply | 3 | $40 | 3 | 12 half-moves | 1.5× |

เพิ่ม fatigue 2 ต่อชั่วโมง; scouting ใช้ 1 AP, $10 และ 1 ชั่วโมงต่อคู่แข่งต่อรายการ ไม่คิดเงินรายงานเดิมซ้ำ เตรียมตัวแบบเดิมในวันเดียวกันซ้ำไม่ได้ ใช้งานไม่ได้หาก AP/เงิน/ชั่วโมงไม่พอ

## ข้อมูลจริงและข้อจำกัดของแบบจำลอง

FIDE ยืนยัน Candidates 2024 จัดที่ Toronto วันที่ 3–23 เมษายน มีผู้เล่น Open 8 คน แข่ง double round-robin 14 รอบ รุ่นนี้ใช้วันที่ สถานที่ และรูปแบบดังกล่าวใน edition ปี 2024 พร้อมลิงก์แหล่งข้อมูล:

https://www.fide.com/fide-publishes-regulations-for-2024-candidates-tournaments/

ผู้เข้าแข่ง ผล ค่าสมัคร เส้นตายรับสมัคร เงื่อนไขคัดเลือก เงินรางวัล และ time control ใน career ยังเป็นกติกาเกมที่ดัดแปลง ไม่ใช่การสร้าง historical record ใหม่ รายการอื่นระบุว่าเป็น fictional/inspired และใช้ตารางจำลอง ระบบเวลาในเกมเป็นปี/สัปดาห์ 52 สัปดาห์; การเริ่มรายการและหมดเวลาตรวจที่ระดับสัปดาห์ ไม่ได้จำลองตารางรอบรายวันจริงทุกวัน

Swiss เป็นระบบของเกมที่ตรวจการจับคู่ไม่ซ้ำด้วย maximum matching พร้อม score/color/bye preferences **ไม่ใช่โปรแกรม FIDE-certified Dutch pairing** ใช้ Buchholz Cut 1, Buchholz, Sonneborn–Berger, wins, Elo และ ID ตามลำดับที่ระบุบนหน้าจอ; round-robin ใช้ SB ก่อน และพักรอบได้ 0 คะแนน

National teams ใช้ simulation แยก: สูงสุด 8 ทีม ประเทศละ 4 บอร์ด แข่ง round-robin ไม่ใช่การจำลอง Olympiad Swiss ทุกบอร์ดตามกฎ FIDE เต็มรูปแบบ ผู้เล่นที่ติดทีมต้องสมัครและเริ่มในสัปดาห์แข่ง ใช้ 2 AP มีรางวัลส่วนตัวสูงสุด $160 และไม่เปลี่ยน individual Elo ผู้ไม่ติดทีมดู exhibition ได้ การเตรียมหมากแบบรายบุคคลไม่ถูกคิดเงินสำหรับ team simulation ที่ไม่ได้ใช้ move engine

ไม่ใช้ preferred openings เป็นโบนัส win rate ใน tournament/NPC rating simulation

## การตรวจสอบ

ใช้ dependency จริงของโปรเจกต์ที่ติดตั้งไว้แล้ว ไม่ใช้ React/router/engine shim และไม่ได้รันบนโทรศัพท์ Termux ของผู้ใช้

ผลคำสั่งและ browser scenarios อยู่ใน `verification/` ตารางนี้เป็นผลหลังแก้ปัญหาที่ตรวจพบแล้ว

การทดสอบเฉพาะ Complete ครอบคลุม:

- สมัครช้า/กดซ้ำ/ค่าสมัครผิด/ขีดจำกัด field/title/qualification/nationality/league และการคืนเงิน
- Matching graph 750 ชุด เทียบ exhaustive oracle แยกจาก implementation รวมกรณี greedy trap และ Swiss 9/16/48/128 คน
- Odd/even round-robin, double round-robin พบคู่ละสองครั้งสลับสี, knockout bye/elimination, championship clinch และ tiebreak
- ค่าใช้จ่าย/เวลา/fatigue, paid snapshot, actual repertoire book moves, response priority, backup, duplicate scouting, save migration, qualification/archive และการให้รางวัลครั้งเดียว
- MatchSession จริงกับ deterministic test engine fixture ยืนยัน draw agreement หลัง 20 half-moves (fixture นี้ใช้ตรวจ control flow ไม่ใช่วัดความแรง Stockfish)
- Chromium production app: register spam, AP/เงิน/เวลาหักจริง, repertoire/scouting, reload, layout 320/390/1280 px, เริ่ม Swiss และเล่นด้วย engine จริง, Candidates 2024 และ national team ที่ลงทะเบียนแล้ว

`test:match` ใช้ built-in engine ตามการตั้งค่าของสคริปต์และวิเคราะห์เกมจริง จึงใช้เวลาหลายนาที ส่วน browser suite ตรวจ Stockfish จริงและ fallback ด้วย เวลาบน Cloud นี้ไม่ใช่ benchmark ของ Termux

Vite build ผ่านโดยมีคำเตือน bundle ใหญ่กว่า 500 kB; รุ่นนี้ไม่ได้อ้างว่าแก้ bundle size หรือรับประกันความเร็วเพิ่มเป็นเปอร์เซ็นต์

## วิธีเปิดใน Termux

แตก ZIP ลงโฟลเดอร์ใหม่เพื่อเก็บโปรเจกต์/ประวัติ Git เดิมไว้ แล้วรัน:

```sh
cd Chess-Career-Mode
npm ci
npm run typecheck
npm run test:complete
npm run build
npm run dev -- --host 0.0.0.0
```

เปิด `http://127.0.0.1:5173` บนอุปกรณ์เดียวกัน ZIP ไม่มี `node_modules` หรือ `.git`; `npm ci` จะติดตั้งและคัดลอก Stockfish ผ่าน postinstall ตามเดิม

## ผลตรวจสุดท้าย

| คำสั่ง | ผล |
|---|---|
| `npm run typecheck` | ผ่าน |
| `npm run build` | ผ่าน |
| `npm run test:complete` | ผ่าน |
| `npm run test:world` | ผ่าน |
| `npm run test:play` | ผ่าน |
| `npm run test:session` | ผ่าน |
| `npm run test:match` | ผ่าน · 257.26 วินาที |
| `npm run test:expansion` | ผ่าน |
| `npm run test:ages` | ผ่าน |
| `npm run test:characters` | ผ่าน |
| `npm run test:data` | ผ่าน |
| `npm run test:chess-cache` | ผ่าน |
| `npm run test:engine` | ผ่าน |
| `npm run test:e2e` | ผ่าน · 12/12 browser cases |

พบและแก้ปัญหาจากการตรวจระหว่างทำ: ค่าเริ่มต้น Complete ในเซฟใหม่ไม่ตรงกับ migration; `test:data` รอบสุดท้ายตรวจผ่านทั้งการอัปเกรดซ้ำและการรักษา games/ratings/preferences แล้ว หลักฐานสุดท้ายอยู่ใน `verification/data-results.log`

ภาพจาก browser จริง: `artifacts/complete-prepare-mobile.png` และ `artifacts/complete-swiss.png`

แพ็กโดยไม่รวม `node_modules`, `.git`, `dist`, browser traces หรือผลล้มเหลวระหว่างพัฒนา มี source hash manifest ที่ `verification/PACKAGE-FILES.sha256` ตรวจ CRC และเทียบทุกไฟล์กับ source หลังบีบอัด
