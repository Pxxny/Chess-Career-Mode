> Archived release report. Current implementation and validation: [ESPORTS-REPORT.md](ESPORTS-REPORT.md).

# QoL, World Circuit & UI — Save version 10

อัปเดต 2026-11-08 จาก ZIP `Chess-Career-Mode-Complete-Tournament-Swiss-Prepare.zip` ที่แนบ ไม่ได้นำโปรเจกต์รุ่นเก่ามาทับ

## สิ่งที่เปลี่ยนตามคำขอ

| จุดใช้งาน | ผลที่ได้ |
|---|---|
| Profile → Stats → Favorite openings | กดชื่อ opening เพื่อเปิดประวัติเกม rated career ที่อยู่ในสถิติ opening นั้น พร้อม W/D/L คู่แข่ง สี และรายการแข่ง กด Replay ได้เมื่อยังเก็บหมากของเกมไว้ เกมเก่าที่ไม่มีหมากยังแสดงผลได้โดยไม่สร้าง replay ปลอม |
| Complete → Tournament standings | กดชื่อ NPC หรือตัวเองเพื่อดูผลเฉพาะทัวร์นั้นจากมุมมองคนที่เลือก W เขียว, L แดง, D เทา มีรอบ สี คู่แข่ง Elo และสถานะ Upcoming; เกมกับผู้เล่นที่เก็บหมากไว้เปิด replay ได้ ส่วน NPC–NPC แสดงผลจำลองที่บันทึกไว้ |
| รายการที่สมัครแล้ว | ปุ่ม Simulate until tournament เปิดแผนฝึกก่อนยืนยัน เลือกหลาย session หรือไม่เลือกเพื่อพักได้ ใช้ AP/เงิน/ชั่วโมง/fatigue/XP ตาม `performSession()` เดิม รวม camp เต็มวันและวิเคราะห์เกมที่ยังมีค้างอยู่; session ที่ต้องเลือก opening/opponent/master แบบโต้ตอบยังทำเองใน Sessions |
| การเดินเวลา | ฝึกวันละครั้งต่อ session ตามลำดับในหน้าจอ แล้ว End Day จริง หยุดที่รายการที่สมัครไว้ใกล้ที่สุดเพื่อไม่ข้ามรายการก่อนหน้า ยกเลิกได้หลังจบวันปัจจุบัน และป้องกันคำสั่งงาน/ฝึกซ้อนระหว่างข้ามเวลา |
| White / Black repertoire | แก้สาเหตุที่ตัดเหลือ 100 แถวแรก เพิ่มตัวเลือก family, ค้นชื่อ/ECO และ More variations เข้าถึงทุก variation ที่ตรงตัวกรอง เริ่มต้นด้วยตัวแทนจากหลาย family จึงไม่กองอยู่ที่ A00/B00; แยก White/Black และ responses ตามสี/หมากแรกอย่างเหมาะสม |
| Openings → Preferences | กระจายตัวเลือกหลาย family และโหลดเพิ่มได้ แทนการซ่อนทุกแถวหลัง 40 รายการแรก |
| Train → Work | เพิ่มงานหาเงิน 4 ชนิด มีเงื่อนไข AP/เวลา/เรตติ้ง/reputation และเพดานรายวัน บันทึกรายรับใน ledger |
| รายการอ้างอิง FIDE | เพิ่ม offline snapshot 60 รายการจาก 11 ประเทศ พร้อม URL แหล่งที่มาของแต่ละรายการ, venue, วันที่ และ time control ที่อ่านจาก detail page |
| ทัวร์ในและต่างประเทศ | ปฏิทิน 52 สัปดาห์มีประมาณ 160 รายการใน fixture ที่ตรวจ จำนวนขึ้นกับ career/date เพิ่ม home club circuit ทุกสองสัปดาห์และ foreign circuit ตลอดปี ชื่อแบบ series/club แทนชื่อเมืองซ้ำ ๆ มีตัวกรอง Home / Abroad / Country และ FIDE-listed / In-game |
| Local players | เพิ่ม fictional NPC ส่วนกลางจาก 1,200 เป็น 4,000 และกลุ่มท้องถิ่นสูงสุด 80 คนต่อ home cohort ตามประเทศ/เมืองของผู้เล่น ทัวร์ local ตั้งเป้าผู้เล่นประเทศเจ้าภาพ 65–70% โดยเลือกคนในเมืองก่อน ถ้ามีไม่พอจึงเติมผู้เล่นอื่น ส่วน National Championship ที่จำกัดสัญชาติใช้เฉพาะเจ้าภาพ |
| สัญชาติ/สหพันธ์ | เพิ่ม Profile → Nationality & federation เปลี่ยนประเทศที่เป็นตัวแทนในเกมได้เมื่อ 1800 Elo และมี 25 rated career games จ่าย $250 รอ 30 วันเกม และเปลี่ยนได้หนึ่งครั้งต่อปีเกม |
| Home | แสดงวัน วันที่ เดือน ปี และ week/day จากปฏิทินเกม มีทางลัด Work & income |
| เมนู/ฟอนต์/สี | ใช้เมนูหลักและเมนูย่อยในทิศทางเดียวกัน เส้นใต้บอกหน้าปัจจุบัน แถบที่เลื่อนได้เลื่อนเฉพาะแนวนอน ใช้ Manrope สำหรับหัวข้อและเนื้อหา พื้น charcoal อมเขียว ข้อความสีอุ่น accent เขียวหม่น เอา radial gradient ออก |
| การใช้งานด้วยแป้นพิมพ์ | Tab IDs ไม่ชนกันระหว่างเมนูซ้อนกัน Modal มีปุ่มปิด, Escape, focus trap และคืน focus เมื่อปิด |

## งานหาเงิน

| งาน | รายรับ | ชั่วโมง | AP | เงื่อนไข |
|---|---:|---:|---:|---|
| Club assistant | $30 | 2 | 1 | เริ่มได้ทุกคน |
| Chess columnist | $55 | 2 | 1 | 1400 Elo |
| Private chess lesson | $100 | 3 | 2 | 1800 Elo, reputation 5 |
| Simultaneous exhibition | $180 | 4 | 3 | 2200 Elo, reputation 20 |

แต่ละงานทำได้ครั้งเดียวต่อวัน และรวมไม่เกินสองงานต่อวัน เพิ่ม fatigue ตามงาน ไม่หัก AP/ชั่วโมงถ้าทำไม่ได้ การกดงานเดิมซ้ำไม่ให้เงินซ้ำ

## การย้ายสหพันธ์และค่าเดินทาง

- เป็นกติกาสำหรับ career ในเกม ไม่ได้อ้างว่าใช้ค่าธรรมเนียม ระยะเวลารอ หรือเงื่อนไขทางกฎหมายของ FIDE จริงทุกข้อ
- ระหว่างรอ 30 วันยังเป็นตัวแทนประเทศเดิม การเปลี่ยนเสร็จหลัง End Day เมื่อไม่ได้ติดเกม/ทัวร์ที่กำลังเล่นอยู่
- เมื่อเสร็จจะย้าย home city เป็นเมืองหลวงของประเทศใหม่ รีเซ็ตสมาชิก Federation และยกเลิก/คืนเงินรายการ national หรือ federation ที่เข้ากันไม่ได้
- คง birth federation ใน career record และ QoL state ไว้ เกมเก่า, Elo, title และผลการแข่งขันไม่ถูกเขียนใหม่ เปลี่ยนไม่ได้ซ้ำทันที; cooldown หนึ่งปีเกมคือ 364 วันตามปฏิทิน 52 สัปดาห์เดิม
- ค่าดำเนินการ $250 ไม่คืนเงิน หากเริ่มคำขอซ้ำหรือไม่ผ่านเงื่อนไขจะไม่หักเงิน
- ตอนสมัครทัวร์แสดงค่าสมัคร ค่าเดินทาง และยอดรวม ค่าเดินทางในประเทศ $0, ทวีปเดียวกัน $60, ต่างทวีป $120 ล็อกราคาตามการสมัครที่จ่ายแล้ว ยกเลิกก่อนสัปดาห์เริ่มได้คืนค่าสมัครและค่าเดินทาง รายการเก่าที่ไม่มี travel field ใช้ $0 เพื่อความเข้ากันได้

## แหล่ง FIDE และขอบเขตข้อมูล

ต้นทาง: https://ratings.fide.com/rated_tournaments.phtml

อ่าน public endpoint ที่หน้านี้ใช้และ detail page ของรายการ เก็บเฉพาะข้อเท็จจริงเรื่องชื่อ สถานที่ ประเทศ วันที่ รูปแบบ และ time control ใน `src/data/chess/fide-tournaments.json` และ typed catalogue `fideReferences.ts`

Snapshot ตรวจเมื่อ **2026-11-08** ครอบคลุม Thailand, India, Vietnam, Singapore, Malaysia, England, France, USA, Germany, Spain และ Netherlands ไม่ดึง network จากเครื่องผู้เล่นระหว่างเปิดเกม จึงเล่น offline ได้หลังติดตั้ง

- Edition ปี 2026 แสดงวันเริ่ม/จบที่ตรวจได้จาก FIDE ถ้าต้นทางไม่ระบุวันจบจะใช้ window ของเกม ไม่แอบใช้ received-date เป็น end-date
- ปีอื่นระบุว่าเป็น **career edition** ที่อ้างอิงชื่อ/รูปแบบจาก snapshot ไม่อ้างว่าเป็นประวัติศาสตร์จริงในปีนั้น
- ค่าสมัคร เส้นตายรับสมัคร Elo gates จำนวนผู้เข้าแข่งสูงสุด จำนวนรอบ ค่าเดินทาง prize/prestige และผลที่เกิดใน career เป็นค่าดัดแปลงของเกม ไม่ใช่การรับรองโดย FIDE หรือผลการแข่งขันจริง
- Time controls แบบหลายช่วงที่ engine/clock ยังไม่รองรับใช้ค่าที่ดัดแปลงสำหรับเกม ข้อความต้นฉบับยังอยู่ใน snapshot
- ปฏิทินภายในยังใช้ปี/สัปดาห์ 52 สัปดาห์ กติกาวันเริ่ม/สิ้นสุดรายการยังตัดที่สัปดาห์ ไม่ได้สร้าง timetable รายวันครบทุกกระดาน

**Swiss ยังเป็น custom game Swiss เดิม ไม่ใช่ FIDE Dutch เต็มรูปแบบ** รุ่นนี้ไม่ได้แก้ประเด็น strict colours, absolute no-rematch, float history, half-point bye หรือ tie-break ที่เคยตรวจไว้ การมี FIDE-listed tournament references ไม่ได้เปลี่ยนสถานะนี้

## เซฟเก่าและจำนวน NPC

- Save version 10 เพิ่มค่าเริ่มต้นแบบเดียวกันทั้งสร้างตัวและ migration คงข้อมูลเดิมทุกช่องที่มีอยู่
- ตัวอย่างโลกใหม่ปี 2026 ประเทศไทย/กรุงเทพฯ: **4,162 NPC** = fictional ส่วนกลาง 4,000 + legends 82 + local cohort 80 ตัวเลขที่ active จริงขึ้นกับยุคและอายุ
- หาก metadata ของโลกเดิมเป็น count 1,200 และ schema ที่รองรับ จะ merge เฉพาะ NPC IDs ที่ยังไม่มี แทนการ rebuild ทับคนเดิม
- ทดสอบ NPC ที่เปลี่ยนชื่อและ Elo ไว้ในเซฟเก่าแล้ว: หลังเพิ่มฐานยังเป็นชื่อและ Elo เดิม รายการลงแข่งเดิมยังอ้าง ID เดิมได้
- Local cohort มี ID คงที่ โหลดซ้ำไม่เพิ่มคนซ้ำ เมื่อย้ายประเทศจะเพิ่มกลุ่ม home ใหม่อีกชุด ข้อมูลของประเทศเก่าไม่หาย และยังมี annual recruits 100–250/ปีและเกษียณตามระบบเดิม

## การตรวจจริง

ใช้ Node 24.22.1, npm 11.9.0 และ Chromium บน Cloud พร้อม dependencies จริง ไม่มี React/router/UI shim ไม่ได้รันบนมือถือ Termux ของผู้ใช้

Browser suite มี **15 เคส** รวมการเล่น Stockfish/fallback จริง การโหลดเซฟเก่า clocks/boards, profile/history/replay, งานหาเงิน, repertoire, การข้ามวัน, federation processing, cancellation, additive NPC migration และ viewport 320/390/768/1280 ตามแต่ละเคส

เคส history และ transfer eligibility ใช้ข้อมูล fixture ที่ระบุชัดในเทสต์ เพื่อทดสอบการแสดงผล/เงื่อนไขโดยไม่ต้อง grind 25 เกม ส่วน registration/training/work/transfer/advance และการสร้าง NPC ใช้ production actions จริง การทดสอบแกน MatchSession/engine เดิมยังรันครบ

`test:qol` ตรวจการหักเงิน/AP/ชั่วโมง การกดซ้ำเพดานงาน, ค่าโอน/วันรอ/cooldown, ค่าเดินทางและคืนเงิน, quota ผู้เล่นท้องถิ่น, repertoire ทั้งฐาน, การรักษา NPC เดิม, การหยุดที่รายการใกล้ที่สุด, ยกเลิก และการไม่เขียนสถานะฝึกข้าม career

ค่าจาก unit run หนึ่งครั้งบน Cloud: สร้าง NPC โลก+ท้องถิ่นประมาณ 180–200 ms, สร้างปฏิทิน 52 สัปดาห์ประมาณ 3 ms ตัวเลข advance14Days ใน unit log ใช้ memory I/O และ NPC fixture จึงใช้ตรวจ control flow ไม่ใช่ benchmark เว็บหรือ Termux

Vite build ยังเตือน bundle ใหญ่กว่า 500 kB; รุ่นนี้ไม่ได้อ้างว่าทำ code splitting หรือรับประกัน FPS/ความเร็วเพิ่มเป็นเปอร์เซ็นต์

ผลคำสั่งสุดท้ายอยู่ใน `verification/qol/` และตารางสรุปท้ายรายงาน ภาพจากแอปจริงอยู่ใน `artifacts/qol-*.png`

## เปิดใน Termux

แตก ZIP ลงโฟลเดอร์ใหม่ แล้วรัน:

```sh
cd Chess-Career-Mode
npm ci
npm run typecheck
npm run test:qol
npm run build
npm run dev -- --host 0.0.0.0
```

เปิด `http://127.0.0.1:5173` บนอุปกรณ์เดียวกัน ZIP ไม่รวม node_modules หรือ .git และมี engine assets/ใบอนุญาตตามรุ่นก่อน `npm ci` ติดตั้งและเตรียม engine/data ผ่าน postinstall ตามเดิม

## ผลคำสั่งสุดท้าย

| คำสั่ง | ผล |
|---|---|
| `npm run typecheck` | ผ่าน |
| `npm run build` | ผ่าน |
| `npm run test:match` | ผ่าน · 222.75 วินาที |
| `npm run test:qol` | ผ่าน |
| `npm run test:complete` | ผ่าน |
| `npm run test:world` | ผ่าน |
| `npm run test:play` | ผ่าน |
| `npm run test:session` | ผ่าน |
| `npm run test:expansion` | ผ่าน |
| `npm run test:ages` | ผ่าน |
| `npm run test:characters` | ผ่าน |
| `npm run test:data` | ผ่าน |
| `npm run test:chess-cache` | ผ่าน |
| `npm run test:engine` | ผ่าน |
| `npm run test:e2e` | ผ่าน 15/15 |
| FIDE data/UI targeted rerun | ผ่าน 1/1 หลังคัด reference ที่จำกัดอายุออก |

การตรวจระหว่างทำแก้ selector มือถือให้ใช้ accessible tabpanel แทน ID คงที่ และแก้เทสต์รอบ local ให้ยึดจำนวนรอบที่กำหนดของรายการจริง ข้อมูลอ้างอิงท้ายรุ่นคัด G12/Senioren ออกแล้วแทนด้วยรายการ unrestricted ที่ตรวจจาก FIDE เพิ่มสองรายการ ไม่ได้เปิดรายการจำกัดอายุเป็น open โดยไม่ตรวจเงื่อนไข

ภาพ UI จริง: `artifacts/qol-home-desktop.png`, `artifacts/qol-foreign-mobile.png`, `artifacts/qol-tournament-history.png`

ตรวจ ZIP ด้วย CRC และเทียบ byte ของทุกไฟล์กับ source หลังบีบอัด มี `verification/qol/PACKAGE-FILES.sha256` สำหรับตรวจซ้ำ ไม่รวม node_modules, .git, dist, browser traces หรือผลล้มเหลวระหว่างพัฒนา
