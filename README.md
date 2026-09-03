# موتو کلینیک ولیعصر(عج)
نرم‌افزار هوشمند مدیریت تعمیرگاه موتورسیکلت.

## معماری
- Web: رابط کاربری
- API: هسته Backend
- Core: مدل‌ها و منطق دامنه
- DB: PostgreSQL schema
- Docker Compose: اجرای سرویس‌ها

## زنجیره عملیاتی
Customer → Motorcycle → Case → Tasks → Technician → Estimate → Approval → Repair → Delivery → History

## اجرا
```bash
docker compose up --build
```
