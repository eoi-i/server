# Server Mariam (Node.js + PostgreSQL)

خادم Node.js خفيف مع لوحة حالة عربية ودعم PostgreSQL عبر متغير Fly.io السري `POOLED_CONNECTION`.

## التشغيل

يتطلب Node.js 22 أو أحدث. بعد تثبيت الاعتماديات عبر `npm install`:

```bash
npm start
```

## إعداد Fly.io

أضف رابط الاتصال كـ **Secret** في Fly.io، ولا تضعه في Git أو ملفات الإعداد العامة:

```bash
fly secrets set POOLED_CONNECTION='postgres://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require' DB_API_TOKEN='ضع-هنا-قيمة-سرية-طويلة-وعشوائية'
```

استخدم قيمة رابط قاعدة البيانات الفعلية التي زودك بها مزودك؛ المثال أعلاه توضيحي فقط. لا تشارك الرابط أو الرمز في المحادثات أو السجلات. بعد ضبط الأسرار انشر التطبيق من جذر المشروع:

```bash
fly deploy
```

يبدأ الخادم حتى لو لم يكن `POOLED_CONNECTION` مضبوطاً، لكن قاعدة البيانات ستظهر غير متاحة. لا تُعرض بيانات الاتصال أو كلمة المرور عبر الواجهات.

## واجهات API

- `GET /health` — فحص حياة الخادم.
- `GET /api/status` — مدة التشغيل والذاكرة وإصدار Node.js.
- `GET /api/db` — فحص اتصال PostgreSQL بـ `SELECT 1`، دون كشف أسرار أو بيانات.
- `GET /api/db/records?limit=20` — قراءة أحدث السجلات (الحد الأقصى 100).
- `POST /api/db/records` — تخزين JSON كسجل جديد في جدول `app_records`؛ ينشئ الجدول تلقائياً عند أول استخدام.

واجهتا السجلات محميتان بمتغير `DB_API_TOKEN`، ويجب إرسال الرمز في ترويسة `Authorization: Bearer ...`. مثال:

```bash
curl 'https://YOUR-APP-NAME.fly.dev/api/db/records?limit=10' \
  -H 'Authorization: Bearer YOUR_DB_API_TOKEN'

curl -X POST 'https://YOUR-APP-NAME.fly.dev/api/db/records' \
  -H 'Authorization: Bearer YOUR_DB_API_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"message":"hello","number":123}'
```

حد حجم JSON هو 1 MiB. استخدم PostgreSQL pooled connection string الخاص بمزودك وتأكد من السماح باتصال تطبيق Fly.io بقاعدة البيانات. يظل `/health` فحص حياة للخادم فقط؛ استخدم `/api/db` للتحقق من قاعدة البيانات.

## ملاحظات أمنية

نقطة `/api/echo` تجريبية وتعكس ما يُرسل إليها. لا ترسل أسراراً أو بيانات شخصية. عمليات السجلات تتطلب رمزاً سرياً، واستخدم HTTPS دائماً ولا تضع الأسرار داخل المستودع.
