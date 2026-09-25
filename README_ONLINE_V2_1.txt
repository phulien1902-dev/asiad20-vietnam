ASIAD20 - VIET NAM HOM NAY V2.1 ONLINE
======================================

Muc tieu: dua Web App len Internet bang mot link co dinh. Nguoi dung bam link la mo App ngay, khong can bat may tinh cua ban.

Cau hinh da san sang cho Render:
- Runtime: Node.js
- Start: npm start
- Port: tu dong nhan bien moi truong PORT cua hosting
- Health check: /api/health
- Du lieu Bornan duoc server lay truc tiep

TRIEN KHAI NHANH TREN RENDER
1. Tao mot repository GitHub moi.
2. Tai TOAN BO noi dung thu muc release nay len repository (cac file server.mjs, index.html, app.js... nam o thu muc goc).
3. Dang nhap Render va chon New > Blueprint.
4. Ket noi repository GitHub vua tao.
5. Render doc file render.yaml va tao Web Service.
6. Sau khi deploy xong, Render cap mot URL https://...onrender.com.
7. Mo URL do: App ASIAD20 se mo truc tiep.
8. Kiem tra them URL /api/health phai hien ok=true va version=2.1.0.

LUU Y
- Khong dua node_modules, .cache, file backup/test/patch len repository.
- Giao dien bang tong sap huy chuong duoc giu nguyen tu V2.0.1.
- Neu dung goi hosting mien phi, dich vu co the ngu sau mot thoi gian khong truy cap; lan mo dau co the cham hon.
