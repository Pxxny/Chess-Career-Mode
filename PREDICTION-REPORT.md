# Match Prediction & Calibration — รายงานผล

ทดสอบบนไฟล์ล่าสุด `Chess-Career-Mode-Multi-Day-Tournaments-Esports.zip` และพัฒนาเป็น **Chess-Career-Mode-Match-Prediction-Calibration** (save version 13)

ระบบหลักใช้งานได้: typecheck/build ผ่าน, ชุดตรวจลอจิก 15 ชุดผ่าน และ Chromium 27/27 ผ่าน มี log จริงใน `verification/prediction/` และข้อมูลสรุปที่อ่านด้วยโปรแกรมได้ใน `results.json`

## สิ่งที่เพิ่ม

- โมเดล Elo baseline และโมเดล Context + history แยกกัน ทุกโมเดลรักษาสมการ expected score กับ W/D/L
- ปัจจัยผู้เล่นและคู่แข่ง: Elo/peak, tactics, calculation, opening knowledge, positional understanding, endgame, visualization, time management, concentration, mental toughness, preparation, form, morale และ fatigue
- เงื่อนไขสี/time control/แรงกดดัน/ความสำคัญรายการ/แผน opening/ความคุ้นเคย/การเตรียมที่จ่ายแล้ว/สถิติพบกัน น้ำหนักและ draw priors ปรับได้ มีเพดานค่าปรับรวมเริ่มต้น ±100 Elo
- แผงก่อนเกมใน Home, Tournament, Swiss, Prepare/Scout, การตั้งค่าเกม, Esports และ Match Viewer; ประวัติ/รีเพลย์เปรียบเทียบ original กับ actual
- Career → Match predictions: Accuracy, Upsets, Elo calculator และ Model settings
- เครื่องคิดเลข `/matchup` ไม่ต้องมีตัวละคร กรอกสอง Elo ได้อิสระ พร้อมตรวจข้อมูลว่างและช่วง 0–4000
- เก็บ snapshot ก่อนหมากแรกสำหรับเกมที่เล่นบนกระดาน ส่งต่อผ่าน checkpoint และบันทึกผล ไม่คำนวณคำทำนายใหม่หลังรู้ผล เกม NPC แบบสุ่มสร้าง forecast ก่อนสุ่มผลแล้วจึงเรียนรู้
- NPC regular boards ในทัวร์ปกติ/Esports/ทีมชาติ/weekly circuit ใช้หลัก W/D/L เดียวกัน ไม่บังคับให้ตัวที่ Elo สูงกว่าชนะ
- บันทึก upset ของผู้เล่นและ NPC แยกสถิติ Elo ที่เอาชนะมากที่สุดกับชัยชนะที่โอกาสน้อยที่สุด
- แยก Elo, peak, form และ head-to-head ของ Online Blitz จากอาชีพปกติ; กันส่งผลซ้ำ/กู้ซ้ำและกันงาน Training simulation เขียนข้ามตัวละครเมื่อออกจากหน้าหรือเปลี่ยนเซฟ

## สมการและการเรียนรู้

```text
Elo E = 1 / (1 + 10^((opponent - player) / 400))
Context E = 1 / (1 + 10^(-(ratingGap + boundedModifiers) / 400))
D = min(smoothedDrawEstimate, 2 * min(E, 1-E) * drawScoreShare)
W = E - D/2
L = 1 - W - D
```

`drawScoreShare` เริ่มต้น 0.85 จึงไม่กิน expected score ของ underdog ไปกับผลเสมอทั้งหมด ไม่มีการใส่ win floor 2% ให้ทุกคู่แม้ Elo ห่างมาก ค่าจริงอยู่ใน 0–1 และรวมเป็น 1 ภายใต้ความละเอียด floating point; ตัวเลขหน้าจอใช้ largest remainders รวมเป็น 100.00% ที่สองตำแหน่ง

กลุ่มข้อมูลมี Elo gap, rating range, time control, colour, opening plan ที่รู้ก่อนแข่ง, archetype/style และ tournament type ใช้ coarse/joint/marginal cells, threshold เริ่มต้น 20 เกม, prior 160 เกมและ residual weight 0.65 ไม่บวกจำนวนเกมของกลุ่มซ้อนกันให้กลายเป็นหลักฐานหลายเท่า เซฟเก่าที่ไม่มี snapshot ไม่ถูกนำมาทำนายย้อนหลัง

เกมบาย/forfeit/การออกกลางคัน/ตำแหน่งฝึกพิเศษไม่ถูกใช้สอน draw rate ผลแพ้จากการทิ้งเกมที่มี snapshot ยังถูกเก็บสำหรับ scoring ตามผลจริง แต่ marked excluded from draw learning

## ผลคำสั่ง

สภาพแวดล้อม: Linux Cloud, v24.22.1, Chromium 156.0.8078.79 built on Debian GNU/Linux 13 (trixie); ใช้ React/TypeScript/แพ็กเกจจริงตาม lockfileที่ติดตั้งอยู่แล้ว ไม่มี dependency ใหม่ และไม่ได้รัน `npm ci` ซ้ำบนชุด node_modules ที่ใช้งานร่วมกัน

| คำสั่ง | ผล | เวลาที่วัด |
|---|---|---|
| `npm run typecheck` | ผ่าน | 6.625 s |
| `npm run test:prediction` | ผ่าน | 1.404 s |
| `npm run test:world` | ผ่าน | 6.356 s |
| `npm run test:play` | ผ่าน | 7.206 s |
| `npm run test:session` | ผ่าน | 0.736 s |
| `npm run test:engine` | ผ่าน | 0.483 s |
| `npm run test:chess-cache` | ผ่าน | 0.482 s |
| `npm run test:characters` | ผ่าน | 0.614 s |
| `npm run test:ages` | ผ่าน | 2.660 s |
| `npm run test:data` | ผ่าน | 0.948 s |
| `npm run test:expansion` | ผ่าน | 1.529 s |
| `npm run test:complete` | ผ่าน | 1.859 s |
| `npm run test:qol` | ผ่าน | 2.033 s |
| `npm run test:circuit` | ผ่าน | 1.565 s |
| `npm run test:esports` | ผ่าน | 0.899 s |
| `npm run test:match` | ผ่าน | 189.915 s |
| `npm run build` | ผ่าน | ดู build.log |
| `CHROMIUM_PATH=/usr/bin/chromium CI=1 npm run test:e2e` | ผ่าน 27/27 | ประมาณ 3 นาที |

Vite มีคำเตือน chunk >500 kB จาก bundle ของแอป แต่ build สำเร็จ ไม่มี TypeScript error การทดสอบ browser ใช้ production bundle จริง รวมการโหลด/เล่น/วิเคราะห์ด้วย Stockfish และ fallback เมื่อ engine หาย ไม่มีการแทน React/router/state ด้วย shim

## ตรวจความถูกต้องเฉพาะ Prediction

- ตรวจ 32,805 คู่เรตติ้ง ช่วง 0–4000 ในห้า time controls ทั้ง baseline/adjusted: ขอบเขต 0–1, expected score, ผลรวมและตัวเลขที่ปัดบนหน้าจอ
- ตรวจ NaN/Infinity/ค่าต่ำเกินช่วง/ค่าสูงมาก, Elo เท่ากัน, สีสลับกัน, styles, เพดาน context, immutable/detached snapshots และ reset/config validation
- สุ่มผล 400,000 เกมจากโมเดลที่ตรึงไว้ ตรวจทุก W/D/L ภายใน tolerance ที่ผูกกับ binomial variance ไม่ใช่แค่ทายว่าตัวที่ Elo สูงกว่าชนะ
- 100,000 เกมต่อ gap: 0, 200, 400, 800 Elo พบ underdog ชนะจริงแม้ gap 800 โดยไม่สร้าง forced upset
- ทดสอบเรียนรู้อัตราเสมอจากข้อมูลสังเคราะห์ 1,000 เกม และประเมินบน distribution แยก W/D/L = 0.25/0.50/0.25: expected Brier 0.69115 → 0.63779; Log loss 1.13676 → 1.05707 เป็นการตรวจว่ากลไกเรียนรู้ทำงาน ไม่ใช่ผลรับรองความแม่นยำของเกมผู้เล่นจริง
- ทดสอบ sparse-data fallback, unique support count, reload, duplicate results, rating changes after outcome, missing legacy state, interruption exclusion, separate rating pools, NPC upset of a career player และการยกเลิก engine simulation
- จบทัวร์ Swiss ตรวจ 49 NPC boards ว่าใช้ original forecasts และไม่มีการนับซ้ำ; ตรวจ NPC archive แบบย่อและการกลับมุมมองขาว/ดำใน history
- ตรวจการเตรียม/สอดแนม Esports กับการหักทรัพยากรจริง รวมการเล่นและกู้เกมข้ามรอบด้วย snapshot ใหม่ของแต่ละรอบ
- Browser ห้ากรณีใหม่ครอบคลุม calculator ก่อนสร้างตัวละคร, เกมจริง+snapshot ก่อนหมากแรก, Home/Swiss/Prepare/NPC calibration, Practice reload และ settings persistence รวม Prepare ที่ยังไม่มีรายการแข่ง
- ตรวจจอ 320, 390 และ 1280 พิกเซล: probabilities, ตารางสถิติ, advanced settings, board/review และเมนูไม่ล้น viewport

## เวลาคำนวณและขนาดข้อมูล

| งาน | ค่าที่วัดบน Node/Cloud |
|---|---|
| สร้าง forecast 10,000 ครั้ง | 112.6 ms |
| เฉลี่ยต่อ forecast | 0.0113 ms |
| บันทึก observation 4,500 รายการเป็น batch | 118.3 ms |
| prediction state ที่เหลือหลัง stress | 537.1 KiB |

นี่คือเวลาโมเดลใน Node ไม่ใช่เวลารวมเปิดเกม/คิดหมาก/IndexedDB/React และไม่ใช่การวัดบนโทรศัพท์หรือ Termux `test:match` ใช้ engine เล่น/วิเคราะห์เกมเต็มจึงใช้เวลาประมาณ 189.9 วินาทีในรอบตรวจนี้

จำกัดรายละเอียดล่าสุด 500 เกมผู้เล่น/ฝึก และ 200 เกม NPC, calibration สูงสุด 1536 cells, dedupe 4096 IDs, upset ล่าสุด 100 รายการ คง lifetime scores/biggest records ไว้เมื่อรายละเอียดเก่าหมดอายุ ส่วน archive ทัวร์ NPC เก็บ probabilities และ conditions แบบย่อ ไม่คัดลอกคุณลักษณะเต็มของทั้งสองฝ่ายทุกกระดาน

## ขอบเขตของตัวเลข

- Prior, น้ำหนักทักษะและ draw-style coefficients เป็นค่าปรับสมดุลเกม ไม่ใช่ค่าที่ fit จากฐาน FIDE จริง
- NPC มี strength/weakness/style/form/morale/training อยู่เดิม จึงแปลงเป็น numeric skill/fatigue estimates และแสดงให้ทราบ ข้อมูลไม่ครบไม่ถูกอ้างว่าเป็นค่าที่วัดจริง
- Sample จาก NPC แบบสุ่มช่วยสอบเทียบความสอดคล้องภายในเกม ความแม่นยำกับมนุษย์/engine ต้องวัดจากเกมที่เกิดขึ้นจริงต่อไป แผงความมั่นใจคุมตามจำนวน/ประเภทข้อมูลและไม่ยกระดับ NPC estimates เป็น High โดยอัตโนมัติ
- เกมเริ่มจากกระดานมาตรฐานได้รับ match forecast; โจทย์ฝึกที่เริ่มจาก FEN พิเศษไม่ถูกใช้เป็นแมตช์ Elo ปกติและไม่สร้างคำทำนายปลอมให้ตำแหน่งนั้น
- เปิดเผย opening เป็นแผนที่รู้ก่อนแข่ง ไม่ใช้ opening ที่เพิ่งจำแนกหลังรู้ผลมาอ้างว่าเป็นข้อมูลก่อนเกม
- ผลบนกระดานจริงยังมาจากหมาก/clock/rules ไม่สุ่มจาก prediction ส่วน decisive tie-break advancement ของทัวร์แบบ knockout เป็นกติกาแยกจากผล regular board ที่เก็บเพื่อ calibration
- ไม่มีการเชื่อมต่อเก็บผลหมากรุกจริงภายนอก และการทดสอบมือถือเป็น Chromium emulation ไม่ใช่เครื่อง Android/iOS จริง

## ไฟล์และการใช้งาน

- `src/game/prediction/`: types, config, model, statistics, adapters
- `src/features/prediction/`: panel, calculator, Career dashboard และ integration previews
- `PREDICTION-GUIDE.md`: คู่มือเปิดเว็บ/อ่านตัวเลข/ตั้งค่า
- `CHANGELOG.md`: รายการเปลี่ยนแปลงพร้อม save migration
- `verification/prediction/`: log และผลสรุปที่รันจริง

ZIP ส่งมอบเป็นโปรเจกต์เต็ม มี lockfile, engine/assets, คู่มือและรายงาน ไม่รวม node_modules/dist/test-results/playwright-report ตรวจ CRC ของ ZIP และเทียบเนื้อหาทุกไฟล์กับ workspace ก่อนส่ง
