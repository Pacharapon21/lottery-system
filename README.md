# Lucky Draw

ระบบจับสลากรางวัลด้วย Next.js, PostgreSQL บน Neon และ Prisma ผู้ชนะและประวัติการสุ่มถูกบันทึกในฐานข้อมูลจริง ไม่มี mock data หรือการสุ่มซ้ำอัตโนมัติเมื่อเปิด/รีเฟรชหน้า

## ตั้งค่าฐานข้อมูล Neon

1. สร้าง PostgreSQL project บน Neon และคัดลอก connection string ทั้งแบบ pooled และ direct จาก Neon Console
2. สร้างไฟล์ `.env` จากตัวอย่าง แล้วกำหนดค่าจริง:

   ```powershell
   Copy-Item .env.example .env
   ```

   - `DATABASE_URL`: pooled connection string สำหรับแอปพลิเคชัน
   - `DIRECT_URL`: direct connection string สำหรับ Prisma migrations
   - `SESSION_SECRET`: สุ่มค่าอย่างน้อย 32 bytes เก็บเป็น secret ใน environment
   - `ADMIN_EMAIL` และ `ADMIN_PASSWORD`: บัญชีเริ่มต้นของผู้ดูแล รหัสผ่านต้องมีอย่างน้อย 12 ตัวอักษร

   สร้าง secret ได้ด้วย:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
   ```

3. ติดตั้ง dependency และสร้างตาราง:

   ```powershell
   npm install
   npm run db:deploy
   npm run db:seed
   ```

   คำสั่ง seed จะสร้างหรืออัปเดตรหัสผ่านบัญชี Admin ตามค่าใน environment ห้ามใช้รหัสผ่านตัวอย่างใน production

4. เริ่มระบบ:

   ```powershell
   npm run dev
   ```

   หน้าสาธารณะอยู่ที่ `/` และหน้าผู้ดูแลอยู่ที่ `/admin`

สำหรับ production ให้ตั้งค่า environment variables ที่ hosting provider แล้วเรียก `npm run db:deploy` ก่อน deploy application ห้าม commit ไฟล์ `.env`

## กติกาการทำงาน

- หมายเลขสลากเป็น String 5 หลัก ตั้งแต่ `00001` ถึง `99999` และไม่ซ้ำกันภายในกิจกรรม
- สร้างสลากอัตโนมัติตามจำนวน 1–99,999 ใบที่ Admin ระบุ
- `FULL_TICKET` สุ่มหนึ่งใบจากสลากที่ยังไม่เคยได้รับรางวัลในกิจกรรม
- `LAST_3_DIGITS` สุ่มด้วย `crypto.randomInt(0, 1000)` ค้นหาสลากทุกใบที่เลขท้ายตรงกัน และบันทึกผู้ชนะที่ยังมีสิทธิ์ทั้งหมด
- ผู้ชนะถูกจำกัดด้วย unique constraint ต่อสลากและกิจกรรม และผลถูกเขียนใน transaction หลังล็อกกิจกรรมเพื่อป้องกันการสุ่มพร้อมกัน
- ผลใหม่อยู่ในสถานะรอยืนยันก่อน จากนั้น Admin ยืนยันและประกาศแยกกัน การรีเฟรชหน้าอ่านผลเดิมจากฐานข้อมูลและไม่เริ่มสุ่มใหม่
- หน้าสาธารณะแสดงเฉพาะผลที่ประกาศแล้ว ค้นหาสลากและดูประวัติผลย้อนหลังได้

## โครงสร้างข้อมูล

Prisma models ประกอบด้วย `Admin`, `DrawSession`, `Ticket`, `PrizeCategory`, `PrizeResult`, `DrawHistory` และ `AuditLog` มี initial migration ที่ `prisma/migrations/20261109100000_initial`

## คำสั่งที่ใช้บ่อย

```powershell
npm run db:generate
npm run db:migrate
npm run db:deploy
npm run db:seed
npm test
npm run lint
npm run build
```
