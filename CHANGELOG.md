# سجل التغييرات والتحسينات / CHANGELOG

تاريخ التحديث: 2026-04-27

## ملخص التغييرات

تم تحليل وتحسين تطبيق إيجاراتي (`my-rentals-mobile`) مع التركيز على:
- توحيد نظام الألوان والـ theme
- تحسين تجربة المستخدم (UX)
- إضافة مكونات skeleton للتحميل
- إصلاح أخطاء وتحذيرات
- تحسين إمكانية الوصول (Accessibility)

---

## 1. تنظيف المشروع

### حذف الملفات غير المستخدمة
- حذف مجلد `src/app_disabled/` بالكامل
- حذف مجلد `src/app_file_backups/` (~150 ملف نسخة احتياطية)
- حذف مجلد `src/lib_file_backups/` و `src/component_file_backups/`
- حذف جميع ملفات `*.bak.*` و `*.off` المتفرقة في `src/app/`

**النتيجة**: تقلص حجم المشروع من 5.6 ميجا إلى ~940 كيلوبايت.

---

## 2. ملف الإعدادات (`app.json`)

### إصلاح ألوان العلامة التجارية
- **قبل**: `splash backgroundColor: "#208AEF"` (أزرق - لا يطابق هوية التطبيق)
- **بعد**: `splash backgroundColor: "#0F9B6F"` (أخضر تركوازي - لون التطبيق الرئيسي)

- **قبل**: `android.adaptiveIcon.backgroundColor: "#E6F4FE"` (أزرق فاتح)
- **بعد**: `android.adaptiveIcon.backgroundColor: "#EDFAF6"` (أخضر فاتح)

---

## 3. نظام الـ Theme (`src/constants/theme.ts`)

### إضافات جديدة
- `palette.teal/amber/gray/...` — يبقى كما هو
- ألوان semantic إضافية: `primaryMuted`, `successDark`, `dangerDark`, `warningDark`, `infoDark`
- ألوان overlay: `overlay`, `overlayLight` (للـ modals)
- `radii.xs` و `radii.2xl` و `shadows.none` و `shadows.xl`
- ثوابت layout جديدة: `layout.screenPadding`, `headerHeight`, `inputHeight`, `buttonHeight`, `hitSlop`
- حالات إضافية في `statusConfig`: `pending`, `approved`, `rejected`
- دالة `moneyCompact()` للأرقام المختصرة (مثل `1.5م ر.س`)
- دالة `formatNumber()` و `formatDate()` بصيغة عربية
- جميع دوال الـ money الآن آمنة ضد `NaN` و `Infinity`

### تنسيق الأرقام
```typescript
money(1500)        // "1,500 ريال"
moneyShort(1500)   // "2 ألف ريال"
moneyCompact(1500) // "2ك ر.س"
formatDate("2026-04-27") // "27/04/2026"
```

---

## 4. مكونات الـ UI المشتركة (`src/components/ui/shared.tsx`)

### مكونات جديدة
- **`Skeleton`**: مؤشر تحميل متحرك (animated placeholder)
- **`SkeletonCard`**: شكل بطاقة skeleton جاهزة
- **`SkeletonList`**: قائمة من بطاقات skeleton (بديل LoadingState)
- **`IconButton`**: زر دائري للأيقونات (للهيدر وغيره)

### تحسينات
- جميع المكونات الآن لها `accessibilityRole`, `accessibilityLabel`, `hitSlop`
- `Button` يدعم variant جديد: `success` وأيقونة اختيارية
- `EmptyState` يقبل `icon` كـ prop (بدلاً من `📋` ثابتة)
- `ErrorState` يستخدم خلفية حمراء للأيقونة

---

## 5. الصفحة الرئيسية (`src/app/index.tsx`)

### تحسينات
- ✅ **Skeleton loading** بدلاً من شاشة فارغة عند التحميل الأول
- ✅ **Error banner** غير معطّل عند فشل تحميل جزئي (سحب للتحديث)
- ✅ **آمنية الاسم**: `firstName` يتعامل مع الأسماء الفارغة (لا يحدث crash)
- ✅ استخدام `moneyCompact()` للأرقام في البطاقات الضيقة (لا تنقطع الأرقام)
- ✅ **إصلاح رابط معطل**: زر "العقود النشطة" كان يُحوّل إلى `/properties` خطأً — تم إصلاحه إلى `/contracts`
- ✅ جميع الألوان الآن من الـ theme (لا hardcoding)
- ✅ `accessibilityRole` و `accessibilityLabel` في كل زر/بطاقة
- ✅ `numberOfLines` على النصوص لمنع overflow
- ✅ `useEffect` يستخدم `[load]` بدلاً من `[]` (إصلاح warning)

---

## 6. صفحة تسجيل الدخول (`src/app/login.tsx`)

### تحسينات أمان وUX
- ✅ **التحقق المضمّن** من صيغة البريد الإلكتروني (regex)
- ✅ **التحقق من طول كلمة المرور** (4 أحرف على الأقل)
- ✅ **عرض/إخفاء كلمة المرور** (زر العين 👁️ / 🙈)
- ✅ **رسائل خطأ مضمّنة** تحت كل حقل بدلاً من `Alert` فقط
- ✅ تنسيق حقول الخطأ بإطار أحمر و خلفية حمراء فاتحة
- ✅ تعطيل الحقول أثناء التحميل (`editable={!loading}`)
- ✅ `autoComplete="email"` و `autoComplete="password"` للملء التلقائي
- ✅ `accessibilityState={{ busy: loading }}` للأزرار

---

## 7. ملف التنقل (`src/app/_layout.tsx`)

### تحسينات
- ✅ استخدام theme tokens (`colors.primary` بدلاً من `"#0F9B6F"`)
- ✅ إضافة `tabBarHideOnKeyboard: true` (الـ tab bar يختفي عند الكتابة)
- ✅ إضافة `borderBottomWidth` للـ header (تمييز بصري)
- ✅ `accessibilityLabel` لكل tab
- ✅ إخفاء header back-arrow في صفحة الـ login
- ✅ `hitSlop` على أزرار الـ header (تسهيل الضغط على الأجهزة الصغيرة)

---

## 8. صفحة المستأجرين (`src/app/tenants.tsx`)

### تحسينات
- ✅ **Skeleton list** أثناء التحميل
- ✅ **زر مسح البحث** (×) داخل حقل البحث
- ✅ **Empty state ذكي**: رسالة مختلفة عند عدم وجود نتائج بحث vs قائمة فارغة فعلياً
- ✅ Keyboard `returnKeyType="search"`
- ✅ Avatar safe (يحول الحرف الأول لكبير ويتعامل مع null)
- ✅ `numberOfLines` لمنع overflow
- ✅ `accessibilityLabel` في كل عنصر

---

## 9. صفحة الدفعات (`src/app/payments.tsx`)

### تحسينات
- ✅ **Skeleton list** أثناء التحميل
- ✅ **تأكيد قبل تسجيل السداد** (`Alert` تأكيد بدلاً من تسجيل فوري)
- ✅ **Overdue alert قابل للضغط**: ضغطه يفلتر الدفعات المتأخرة فقط
- ✅ استخدام `StatusBadge` المشترك بدلاً من نسخة محلية
- ✅ استخدام `formatDate()` لعرض التواريخ بصيغة عربية
- ✅ Empty state ذكي (رسالة مختلفة لكل filter)
- ✅ جميع الألوان من theme

---

## 10. صفحة الإعدادات (`src/app/settings.tsx`)

### تحسينات
- ✅ استخدام theme tokens بدلاً من hardcoding
- ✅ `accessibilityRole="button"` لكل عنصر قائمة
- ✅ `numberOfLines` لمنع overflow في الأسماء الطويلة
- ✅ Avatar safe (يحول الحرف الأول لكبير)

---

## 11. صفحة الإحصائيات (`src/app/statistics.tsx`)

### تحسينات
- ✅ استخدام theme tokens
- ✅ `accessibilityLabel` و `accessibilityRole`

---

## 12. صفحة التنبيهات (`src/app/alerts.tsx`)

### تحسينات
- ✅ **Skeleton loading** دقيق (يحاكي شكل المحتوى الفعلي)
- ✅ `formatDate()` للتواريخ
- ✅ جميع الألوان من theme (`colors.danger`, `colors.warning`, `colors.info`)
- ✅ `numberOfLines` لمنع overflow
- ✅ `accessibilityLabel` في كل عنصر تنبيه

---

## 13. صفحة العقود (`src/app/contracts.tsx`)

### تحسينات
- ✅ **Skeleton list** بدلاً من `LoadingState`
- ✅ Empty state يحتوي على أيقونة `📄`
- ✅ `colors={[colors.primary]}` للـ RefreshControl (ألوان متعددة على Android)

---

## 14. صفحة العقارات (`src/app/properties.tsx`)

### تحسينات
- ✅ **Skeleton list** عند التحميل
- ✅ Empty state بأيقونة `🏢`

---

## 15. صفحة الوحدات (`src/app/units.tsx`)

### تحسينات
- ✅ تحديث جميع الألوان من Tailwind blue/gray إلى theme الموحد
- ✅ الأزرار الزرقاء (`#2563eb`) أصبحت خضراء (`#0F9B6F` لون التطبيق)
- ✅ الـ borders أصبحت `#DDDBD6` و `#EDECE9` متوافقة مع التطبيق

---

## 16. تحديث جماعي للألوان (32 ملف)

تم استبدال الألوان التالية في **32 صفحة** عبر التطبيق:

| قبل | بعد | السبب |
|------|------|------|
| `#2563eb` (أزرق) | `#0F9B6F` (أخضر) | لون التطبيق الرئيسي |
| `#1d4ed8` (أزرق غامق) | `#065F44` (أخضر غامق) | لتطابق darkVariant |
| `#1e40af` (أزرق غامق) | `#065F44` | نفس السبب |
| `#f5f5f5` | `#F7F6F4` | لون الخلفية الموحد |
| `#f9fafb` | `#F7F6F4` | نفس السبب |
| `#e5e7eb` | `#DDDBD6` | لون الـ border الموحد |
| `#eef2f7` | `#EDECE9` | لون الـ border الفاتح الموحد |
| `#d1d5db` | `#C4C1BB` | textTertiary موحد |
| `#4b5563` | `#5E5B55` | textSecondary موحد |
| `#6b7280` | `#7A766F` | نفس السبب |

---

## 17. مكتبة الـ API (`src/lib/api.ts`)

### إصلاح `apiPostAny`
- **قبل**: تتنقل لكل المسارات صامتاً وتبتلع كل الأخطاء (مشكلة: لو السيرفر رد بـ 422 validation error، التطبيق سيحاول مسار آخر بدلاً من إظهار الخطأ)
- **بعد**: تتنقل لمسار آخر فقط لو الخطأ كان `404 Not Found`، أما باقي الأخطاء (422, 500, etc.) فترفعها فوراً

---

## 18. خطاف useCrud (`src/hooks/useCrud.ts`)

### تحسينات
- ✅ **mountedRef** لمنع state updates بعد إلغاء mount (منع memory leaks)
- ✅ Items الآن دائماً Array آمنة (`Array.isArray(newItems) ? ... : []`)
- ✅ `useEffect` dependencies نظيفة مع `eslint-disable` تعليقات حيث ضروري
- ✅ `useDetail` يُعيد التحميل عند تغيّر الـ endpoint

---

## ملخص الإحصائيات

| المقياس | القيمة |
|---------|--------|
| ملفات حُذفت (نسخ احتياطية) | ~150 |
| ملفات تم تحديثها بالكامل | 11 |
| ملفات تم تحديثها جزئياً | 32 |
| مكونات UI جديدة | 4 (`Skeleton`, `SkeletonCard`, `SkeletonList`, `IconButton`) |
| دوال theme جديدة | 3 (`moneyCompact`, `formatNumber`, `formatDate`) |
| Tokens theme جديدة | 12+ |
| تخفيض حجم المشروع | من 5.6MB إلى ~940KB |

---

## المتطلبات المتبقية (قائمة مستقبلية)

- إضافة Error Boundary على مستوى التطبيق
- إضافة Toast notifications بدلاً من `Alert.alert` لرسائل النجاح
- توحيد جميع الصفحات لتستخدم `useList`/`useDetail` بدلاً من `useState` مباشرة
- توحيد الـ headers في كل الصفحات لتستخدم نفس النمط (`backBtn`, `title`, `count`)
- إضافة dark mode support
- توحيد ألوان `InlineEditDeleteActions.tsx` (904 سطر) و `OwnerDashboardScreen.tsx` (804 سطر)
- اختبارات Unit/E2E
