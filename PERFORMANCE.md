> Archived report from an earlier release. Current Complete implementation and validation: [COMPLETE-REPORT.md](COMPLETE-REPORT.md).

# รายงานแพตช์ประสิทธิภาพ — 7 พฤศจิกายน 2026

ใช้ `Chess Career Mode - Fix Analysis Board Squashed Rows.zip` ที่แนบล่าสุดเป็นฐาน ไม่ได้นำโปรเจกต์รุ่นก่อนมาทับ

SHA-256 ของ ZIP ต้นฉบับ: `83a932872412596198913e1d51f7e7e2dd5e9b4c0963ede74e5fa7c18ad93cbf`

ตรวจด้วย Node 24.22.1, npm 11.9.0 และ Chromium 156 บน Linux ในเครื่องทดสอบนี้ ไม่ได้วัดบนมือถือหรือ Termux ของผู้ใช้

## สิ่งที่แก้

1. `src/game/chess/board.ts`: ลด array/closure ชั่วคราว และใช้กระดานสำเนาหนึ่งชุดต่อ `legalMoves` โดยลองเดิน–ตรวจรุก–คืนตำแหน่ง ไม่แก้กระดานของผู้เรียก
2. `src/game/chess/rules.ts`: cache legal moves ด้วย WeakMap พร้อมตรวจทุกช่องและฟิลด์ของ Position ก่อนใช้ซ้ำ หากผู้เรียกแก้ Position จะคำนวณใหม่ ผล Move ที่ส่งออกแยกจาก cache และ `parseUci` ที่รับรายการ legal เองยังคืน reference จากรายการนั้นตามเดิม
3. `src/features/match/MatchViewer.tsx`: ให้เฉพาะการ์ดนาฬิกาฝั่งที่กำลังเดินอัปเดตทุก 100 ms กระดานและรายการเดินอัปเดตตามเหตุการณ์ของ session
4. `src/features/match/useMatchSession.ts`: เอา display tick ที่ไม่มีผู้ใช้ออกจาก hook และแก้บัคเดิมของ StrictMode ใน dev ซึ่งเคย cleanup แล้วจบเกมใหม่ทันที การ cleanup จริงรอหนึ่ง microtask และยกเลิกได้เฉพาะเมื่อ React setup session เดิมกลับมา ส่วนการออกจริงและเปลี่ยน session ยัง cleanup
5. เพิ่ม `bench:chess`, `test:chess-cache` และ browser regression ของนาฬิกา/กระดาน ปรับ assertion เก่าใน `tests/app.spec.ts` ให้ตรงกับปุ่ม Analysis และ save version ที่กำหนดอยู่จริง

`MatchBoard.tsx`, `PositionBoard.tsx`, `PlayBoard.tsx`, `package-lock.json`, config, engine search, กติกานาฬิกา และ training engine ตรงกับ ZIP ต้นฉบับทุกไบต์ การแก้แถวกระดานล่าสุดยังอยู่ครบ Save version ยังคงเป็น 7; ไม่เปลี่ยน XP, AP, rewards, rating หรือสูตรเศรษฐกิจ

## ผลวัดก่อน–หลัง

รอบยืนยันสุดท้ายรันแต่ละโปรเซสตามลำดับหลังชุดตรวจอื่นจบ ใช้ warm-up หนึ่งครั้งและ median จาก 7 รอบต่อ workload

| Workload | ต้นฉบับ | หลังแพตช์ | เร็วขึ้น |
|---|---:|---:|---:|
| perft ตำแหน่งเริ่มเกม depth 4 — 197,281 nodes | 205.5 ms | 65.7 ms | 3.13 เท่า |
| perft Kiwipete depth 3 — 97,862 nodes | 81.4 ms | 32.7 ms | 2.49 เท่า |

รอบแรกได้ 213.4 → 61.0 ms และ 96.5 → 30.9 ms ตามลำดับ ตัวเลขแกว่งตามสภาพเครื่อง จึงเก็บ raw logs ทั้งสองรอบไว้

เส้นทาง `parseUci → makeMove → detectEnd` ใน harness 60 เกมสุ่ม ลดจาก **2,117.3 → 894.8 ms** (2.37 เท่า; ค่าเฉลี่ย 5 รอบหลัง warm-up รวม overhead ของ harness) ส่วน GC ใน workload perft เริ่มเกม depth 4 จำนวน 5 ครั้ง ลดจาก **1,049 → 328 events**, เวลา GC **96.7 → 33.6 ms** เป็นผลของ workload นี้ ไม่ใช่การวัด peak memory ของทั้งแอป

ที่ engine depth 4 และให้เวลาพอ ทั้งสามตำแหน่งทดสอบได้ best move และ evaluation เหมือนเดิม: เริ่มเกม 219 → 104 ms, Kiwipete 533 → 322 ms, middlegame 1,947 → 836 ms ตัวเลข engine เป็นตัวอย่างหนึ่งรอบต่อกรณี

## ความเท่าเดิมของกติกา

- เทียบ legal moves ทั้งลำดับและฟิลด์บน **84,839 ตำแหน่ง** และผล `applyMove` **2,150,742 ครั้ง**: ตรงกัน พร้อม perft อ้างอิง 5 กรณี
- **300 เกม / 96,705 ply**: GameState, SAN, UCI, repetition keys, การจบเกม และ `movesBetween` ตรงกัน
- ตรวจอิสระเพิ่ม **2,283 ตำแหน่ง** ด้วย input ที่ freeze: legal moves, SAN และตำแหน่งลูกตรงกันและไม่มี input mutation
- Regression ใหม่ผ่านกรณีแก้ board/turn/castling/en-passant/halfmove/fullmove หลังมี cache, แก้ Move ที่ส่งออก, explicit legal array identity, castling, promotion และ en-passant ที่ติด pin

เป็นการตรวจบนชุดข้อมูลดังกล่าว ไม่ใช่ข้อพิสูจน์ทุกตำแหน่งที่เป็นไปได้

## Browser และ UI

ในช่วงรอนาฬิกา 2.2 วินาที โดยสังเกต render ของ component จริงใน Chromium:

| ส่วนที่ render | ต้นฉบับ | หลังแพตช์ |
|---|---:|---:|
| MatchViewer | ประมาณ 22–23 ครั้ง | 0 |
| MatchBoard | ประมาณ 22–23 ครั้ง | 0 |
| การ์ดนาฬิกาที่กำลังเดิน | ประมาณ 22–23 ครั้ง | ประมาณ 22–23 ครั้ง |
| การ์ดอีกฝ่าย | ประมาณ 22–23 ครั้ง | 0 |

นาฬิกายังนับ, pause/resume ทำงาน, เลือกและเดิน e2→e4 ได้ และ interval 100 ms เหลือ 0 หลัง unmount ตรวจทั้งกระดาน live และ review ที่ 320/390 px ว่ามี 64 ช่อง, 8 แถวสูงเท่ากัน และกระดานเป็นสี่เหลี่ยมจัตุรัส

StrictMode: ต้นฉบับจบเกมทันที ส่วนแพตช์ยัง running การ unmount จริงหลังเดินสองตาเรียก finish 1 ครั้ง, analysis 1 ครั้ง, checkpoint 3 ครั้ง (สองตาและล้าง checkpoint) และไม่เหลือ timer ตรวจผ่าน flow ของแอป dev จริงตั้งแต่สร้างตัวละคร → Complete → เล่น → resign → มีเกมที่บันทึกพร้อม analysis เพียงหนึ่งเกม และไม่มี page error

ภาพและข้อมูลดิบอยู่ใน `artifacts/match-performance*.png` และ `artifacts/match-clock-perf.json` การตรวจ render ใช้ instrumentation นับการเรียก component; ไม่ได้แทน React, store, engine หรือกติกาด้วย mock

## ผลคำสั่งจริง

| คำสั่ง | ผล | เวลาที่บันทึก |
|---|---|---:|
| `npm ci` | ผ่าน | ประมาณ 4 s |
| `npm run typecheck` หลังแก้สุดท้าย | ผ่าน | 7.566 s |
| `npm run build` หลังแก้สุดท้าย | ผ่าน | 13.080 s |
| `npm run test:world` | ผ่าน | 1.619 s |
| `npm run test:play` | ผ่าน | 6.091 s |
| `npm run test:session` | ผ่าน | 0.493 s |
| `npm run test:match` | ผ่าน | 212.173 s |
| `npm run test:engine` | ผ่าน | 0.367 s |
| `npm run test:data` | ผ่าน | 0.585 s |
| `npm run test:chess-cache` | ผ่าน | 0.325 s |
| `npm run bench:chess` | ผ่าน reference assertions ทั้งหมด | — |
| `npm run test:e2e` รอบสุดท้าย | ผ่าน 6/6 | 67.042 s |
| `npm run test:engine:browser` | ผ่าน | 8.942 s |

`test:match` เทียบ chess.js 23,059 ตำแหน่ง และผ่านทั้งการแข่งขัน การสมัคร และ training simulation ใช้ built-in engine ตามที่สคริปต์กำหนด ส่วน browser engine test โหลด **Stockfish Worker จริง** เดินถูกกติกา 16 ply หลายระดับ และยืนยัน fallback เมื่อ manifest/WASM หาย

`test:match` ต้นฉบับผ่านใน 295.574 s แต่เกมเต็มต่างกัน (ต้นฉบับ 170 ply; แพตช์ 146 ply) และมีงานตรวจอื่นร่วมบางช่วง จึงไม่ใช้เวลาทั้ง suite นี้เป็น benchmark ที่ควบคุม workload ตัวเลขความเร็วด้านบนมาจาก workload คงที่

Browser รอบแรกผ่าน 4/6 อีกสองรายการล้มเพราะเทสต์เดิมค้นปุ่ม Review ทั้งที่เกมวิเคราะห์แล้วแสดง Analysis และคาด save version 6 ทั้งที่ config เดิมเป็น 7 แก้เฉพาะเทสต์สามจุดนี้ แล้วรอบสุดท้ายผ่าน 6/6 ไม่มีการเปลี่ยน UI หรือ migration เพื่อให้ตรงกับ assertion เก่า

## ขอบเขตและข้อจำกัด

- Built-in engine ยังรันบน main thread และอาจทำให้ UI รอในช่วงค้นหา ยังไม่ได้ย้ายไป Worker
- ไม่เปลี่ยน depth, movetime, PRNG หรือความยาก แต่เมื่อคำนวณเร็วขึ้น engine ที่จำกัดด้วยเวลาเดิมอาจค้นลึกขึ้นและเลือกหมาก/ผลเกมต่างไป จึงไม่อ้างว่าผลเกมที่จำกัดเวลาจะตรงเดิมทุกเกม
- Build สำเร็จพร้อมคำเตือน bundle ใหญ่กว่า 500 kB (JS ประมาณ 1.53 MB ก่อน gzip) ยังไม่ได้ทำ code splitting
- ตรวจพบหน้า Complete ล้นแนวนอนที่ viewport 320 px ทั้งต้นฉบับและแพตช์ แม้แถวกระดานไม่ยุบ ภาพ full-page ชุดนี้กว้าง 370 px; ที่ 390 px ภาพกว้าง 390 px ขอบเขตที่ล้นขึ้นกับข้อความและฟอนต์ ดู `artifacts/match-layout-overflow.json` การตรวจ 8 แถวไม่ได้แปลว่า layout ทุกส่วนพอดีกับทุกหน้าจอ และไม่ได้แก้ layout ส่วนนี้ในแพตช์นี้
- ไม่เปลี่ยนระบบ save หรือย้ายข้อมูล IndexedDB และไม่ได้ทดสอบประสิทธิภาพบน Termux จริง

## รันซ้ำ

```sh
npm ci
npm run typecheck
npm run build
npm run test:world
npm run test:play
npm run test:session
npm run test:match
npm run test:engine
npm run test:data
npm run test:chess-cache
npm run bench:chess
npx playwright install chromium
npm run test:e2e
npm run dev -- --host 0.0.0.0
```

บน Linux ที่มี Chromium ใช้ `CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e` ได้ Browser tests ไม่ได้ตั้งค่าให้รองรับ Chromium บน Termux โดยตรง

ผลตรวจดิบและสคริปต์ A/B อยู่ใน `performance-evidence/` ภายใน ZIP; `npm run bench:chess` และ `npm run test:chess-cache` รันในโปรเจกต์นี้ได้โดยตรง
