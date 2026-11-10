# Chess Career Mode

เกมจำลองชีวิตนักหมากรุก สร้างตัวละคร ฝึกซ้อม แข่งทัวร์นาเมนต์ ไต่อันดับ Elo จากมือใหม่จนถึงแชมป์โลก เล่นบนเบราว์เซอร์ (มือถือ แท็บเล็ต คอม) รองรับภาษาอังกฤษและไทย ข้อมูลเซฟเก็บในเครื่องของผู้เล่น

## ฟีเจอร์หลัก

- **สร้างตัวละคร** เลือกประเทศ เมืองเกิด ลักษณะนักเล่น หน้าตา และปีเริ่มต้น 1950–2026 (โลก NPC และตำนานหมากรุกตัวจริงปรับตามปีนั้น)
- **ฝึกซ้อม** 19 กิจกรรม ชั่วโมง/AP/ความล้า พักผ่อน และวางแผนหลายวันอัตโนมัติ (พักเองเมื่อเหนื่อย)
- **เล่นหมากรุกจริง** กระดานลากวาง/แตะ, เข้าป้อมโดยแตะคิงแล้วแตะเบี้ยเรือ (หรือแตะเรือแล้วแตะคิง) หรือแตะช่องปลายทางแบบเดิมก็ได้, นาฬิกา, เสียงเดินหมาก/กินหมาก/ใกล้หมดเวลา (ปิดได้จากปุ่มลำโพงบนแถบด้านบน), วิเคราะห์ด้วย Stockfish
- **ทัวร์นาเมนต์** ทัวร์เมือง/ประเทศ/นานาชาติ ทั้งแบบ Open (ทุกเพศทุกวัย), Junior (จำกัดอายุ U12/U14/U17) และ Championship, Swiss, Round Robin หลายวัน, Esports
- **ทีมชาติ 20 รายการ** Olympiad, World/European/Asian Team Championship, Asian Games, SEA Games ฯลฯ มีจำนวนทีม ตัวจริง/ตัวสำรอง และโควตากระดานตามมาตรฐาน FIDE
- **อันดับ** อันดับโลก/ประเทศ/เมือง พร้อมรายชื่อ NPC กดดูโปรไฟล์ได้ นักหมากรุกตัวจริงมีป้าย “Real player”
- **โลกที่มีชีวิต** NPC 4,000 คน ตำนาน 82 คน ความสัมพันธ์ ผลงานย้อนหลัง สรุปประจำปี
- **คาดการณ์ผล** ความน่าจะเป็น ชนะ/เสมอ/แพ้ ก่อนเริ่มแต่ละเกม พร้อมสถิติความแม่นยำ
- **ติดตั้งลงเครื่อง** (PWA) เปิดเต็มจอและเล่นออฟไลน์ได้หลังโหลดครั้งแรก

## ติดตั้งลงเครื่อง (ไม่ต้องใช้ App Store)

เปิดเว็บเกมในเบราว์เซอร์ แล้ว

- **Android / Chrome / Edge:** กดปุ่ม **Install app** ที่หน้า Home หรือเมนูเบราว์เซอร์ → *ติดตั้งแอป*
- **iPhone / iPad:** Safari → ปุ่มแชร์ → *เพิ่มไปยังหน้าจอโฮม*

เซฟอยู่ในเบราว์เซอร์/แอปเครื่องนั้น (IndexedDB) ล้างข้อมูลเว็บไซต์จะทำให้เซฟหาย

## รันเอง

ต้องใช้ Node.js 22.6 ขึ้นไป

```sh
npm ci            # ติดตั้ง + สร้างข้อมูลเมืองและคัดลอก Stockfish อัตโนมัติ
npm run dev       # http://127.0.0.1:5173
npm run build     # typecheck + build ไปที่ dist/
```

ใช้เบราว์เซอร์/โดเมนเดิมเพื่อให้เซฟยังอยู่ ต้องการเปิดจากอุปกรณ์อื่นในเครือข่ายเดียวกันใช้ `npm run dev -- --host 0.0.0.0`

## ทดสอบ

```sh
npm run typecheck
npm run test:world test:play test:data     # รันทีละคำสั่ง
npm run test:team-events                   # ทีมชาติ 20 รายการ
npm run test:expansion test:prediction test:language
npm run test:e2e                           # Playwright ต้อง build ก่อน
```

ชุดทดสอบอื่นดูที่ `scripts/` และ `tests/` ส่วน `test:match` เล่นเกมเต็มกับ Stockfish ใช้เวลาหลายนาที

## โครงสร้างโปรเจกต์

| โฟลเดอร์ | หน้าที่ |
| --- | --- |
| `src/game` | ตรรกะล้วน ไม่มี React: หมากรุก, NPC, ฝึกซ้อม, ทัวร์, ทีมชาติ, คาดการณ์ |
| `src/data` | ค่าตั้งต้นและข้อมูลคงที่: ประเทศ, เปิดเกม, ตำนาน, แคตตาล็อกทีมชาติ |
| `src/features`, `src/pages`, `src/components` | หน้าจอและคอมโพเนนต์ |
| `src/store` | Zustand + IndexedDB (เซฟ 3 ช่อง, โลก NPC แยกต่อตัวละคร) |
| `src/i18n` | ภาษาอังกฤษ/ไทย (ข้อความอังกฤษเป็นต้นฉบับ, `th.ts` เป็นคำแปล) |
| `src/audio` | เสียงสังเคราะห์ด้วย Web Audio |
| `public` | Stockfish, ข้อมูลเมือง (สร้างตอน `npm ci`), ตัวหมาก SVG, manifest + service worker |

จุดที่ปรับเกมบ่อย: `src/data/config.ts` (ค่าพื้นฐาน), `src/data/trainingSessions.ts`, `src/data/chess/tournaments.ts` (ชนิดทัวร์), `src/data/chess/nationalTeamEvents.ts` (ทีมชาติ)

## ดีพลอยบน Vercel

Import repo ใน Vercel (Framework: Vite, build `npm run build`, output `dist`) อย่าปิด install scripts เพราะใช้สร้างข้อมูลเมืองและคัดลอก Stockfish `vercel.json` ตั้ง rewrite ให้ลิงก์ตรงอย่าง `/complete` ใช้ได้ และไม่ให้ `sw.js` ถูกแคช

## อัปเดต GitHub จาก Termux

```sh
pkg install git unzip rsync nodejs-lts
ZIP="$HOME/storage/downloads/<ชื่อไฟล์>.zip"
D=$(mktemp -d "$HOME/chess-update.XXXXXX")
git clone --branch main https://github.com/Pxxny/Chess-Career-Mode.git "$D/repo"
unzip "$ZIP" -d "$D/unpacked"
rsync -av --exclude='.git/' --exclude='node_modules/' --exclude='dist/' \
  "$D/unpacked/Chess-Career-Mode/" "$D/repo/"
cd "$D/repo" && npm ci && npm run build
git add -A && git commit -m "Update" && git pull --rebase origin main && git push
```

## ข้อสังเกตด้านข้อมูล

- ผู้เล่น NPC ทั่วไป ทีม และชื่อรายการทัวร์ส่วนใหญ่เป็นเรื่องสมมติ ตำนานหมากรุกอ้างอิงบุคคลจริง ค่า Elo ย้อนหลังบางส่วนเป็นการประมาณ
- ตัวเลขความน่าจะเป็น เสมอ และ Elo ของ Stockfish เป็นค่าออกแบบเกม ไม่ใช่สถิติ FIDE
- ทีมชาติจัดปีละครั้งในเกม ไม่ใช่รอบจริง และจำนวนทีมถูกจำกัดด้วยสหพันธ์ที่มีผู้เล่นในโลก NPC

## เครดิตและสัญญาอนุญาต

- ตัวหมาก SVG 12 ตัวโดย Colin M. L. Burnett (GPL 2+) ต้นฉบับและข้อความอ้างอิงอยู่ใน `public/pieces/cburnett/`
- Stockfish 16 (GPLv3) ประกาศและลิงก์ซอร์สอยู่ข้างไฟล์เอนจินใน `public/engine/`
- ข้อมูลเปิดหมาก ECO จาก lichess-org/chess-openings (CC0), ข้อมูลประเทศจาก `world-countries`, เมืองจาก GeoNames (`all-the-cities`)
- ฟอนต์ Manrope, Fraunces, Noto Sans Thai ผ่าน Fontsource (ไม่เรียก Google Fonts ตอนรัน)
