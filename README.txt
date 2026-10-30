ملفات موقع مباريات اليوم

1) ارفع كل الملفات الموجودة في هذا المجلد إلى جذر مستودع GitHub live-player:
   index.html, admin.html, watch.html, config.js, app.js, admin.js, watch.js, style.css

2) فعّل GitHub Pages من Settings > Pages:
   Deploy from a branch / main / /(root)

3) افتح الموقع الرئيسي، ولوحة الإدارة من admin.html.
   سجّل الدخول بالبريد وكلمة المرور اللذين أنشأتهما في Supabase Authentication.

4) لا تضع Secret key أو service_role key في أي ملف. config.js يحتوي فقط على Project URL وPublishable key.

5) قبل الاستخدام العام، راجع سياسات RLS في Supabase. سياسات الإدارة التي أنشأتها تربط الإضافة والتعديل والحذف بـ User UID الخاص بك.

ملاحظات:
- زر البث يظهر قبل موعد المباراة بساعة وحتى أربع ساعات بعد بدايتها.
- البث يُعرض داخل iframe؛ قد ترفض بعض مواقع البث التضمين.
- الوقت يُدخل ويُعرض بتوقيت بغداد.
