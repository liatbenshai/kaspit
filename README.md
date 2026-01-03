# כספית - מערכת ניהול פיננסי חכם

מערכת מקיפה לניהול פיננסי לעסקים, כולל מעקב הכנסות והוצאות, תקציבים, דוחות ותובנות חכמות.

## ✨ תכונות עיקריות

- 📊 **דשבורד חכם** - סקירה כללית עם גרפים, התראות והמלצות
- 💰 **ניהול הכנסות והוצאות** - הוספה ידנית או ייבוא מאקסל
- 🏦 **תנועות בנק** - ייבוא ומעקב תנועות בנק
- 📈 **תקציב חכם** - הצעת תקציב אוטומטית ומעקב חריגות
- 📑 **דוחות מפורטים** - דוחות חודשיים, לפי קטגוריה ומגמות
- 🏷️ **קטגוריות מותאמות** - הגדרה עצמית של קטגוריות
- 👥 **ספקים ולקוחות** - ניהול אנשי קשר עסקיים
- 🔔 **התראות חכמות** - התראות על חריגות, תשלומים ועוד
- 🌐 **תמיכה מלאה בעברית** - ממשק RTL מלא

---

## 🚀 הוראות התקנה

### שלב 1: הגדרת Supabase

1. היכנס ל-[Supabase](https://supabase.com) וצור חשבון
2. לחץ על **New Project**
3. בחר שם לפרויקט (למשל: kaspit)
4. בחר סיסמה לבסיס הנתונים (שמור אותה!)
5. בחר אזור (מומלץ: Frankfurt או קרוב אליך)
6. לחץ **Create new project**

### שלב 2: יצירת הטבלאות

1. בתוך הפרויקט, לחץ על **SQL Editor** בתפריט השמאלי
2. לחץ על **New query**
3. העתק את כל התוכן מהקובץ `supabase-schema.sql`
4. לחץ **Run** להרצת הקוד
5. המתן עד שתראה הודעת הצלחה

### שלב 3: קבלת מפתחות

1. לחץ על **Settings** (גלגל שיניים) בתפריט
2. לחץ על **API**
3. העתק את:
   - **Project URL** (זה ה-NEXT_PUBLIC_SUPABASE_URL)
   - **anon public key** (זה ה-NEXT_PUBLIC_SUPABASE_ANON_KEY)

### שלב 4: הגדרת Authentication

1. לחץ על **Authentication** בתפריט
2. לחץ על **Providers**
3. ודא ש-**Email** מופעל
4. (אופציונלי) הפעל אימות נוסף כמו Google

---

## 📤 העלאה ל-GitHub

### אפשרות א: דרך GitHub Desktop (מומלץ למתחילים)

1. הורד והתקן [GitHub Desktop](https://desktop.github.com/)
2. היכנס עם חשבון GitHub שלך
3. לחץ **File** → **Add Local Repository**
4. בחר את תיקיית הפרויקט
5. לחץ **Create Repository**
6. לחץ **Publish Repository**
7. בחר שם ולחץ **Publish**

### אפשרות ב: דרך שורת הפקודה

```bash
cd kaspit
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/kaspit.git
git push -u origin main
```

---

## 🌐 פריסה ב-Vercel

### שלב 1: חיבור ל-Vercel

1. היכנס ל-[Vercel](https://vercel.com)
2. לחץ **Add New** → **Project**
3. חבר את חשבון GitHub שלך
4. בחר את הריפו של kaspit
5. לחץ **Import**

### שלב 2: הגדרת משתני סביבה

בדף ההגדרות לפני Deploy, הוסף:

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | ה-URL מ-Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ה-anon key מ-Supabase |

### שלב 3: פריסה

1. לחץ **Deploy**
2. המתן לסיום הבנייה (2-3 דקות)
3. קבל את הלינק לאפליקציה! 🎉

---

## 📁 מבנה הפרויקט

```
kaspit/
├── app/                    # דפי האפליקציה
│   ├── (dashboard)/        # דפים מאחורי התחברות
│   │   ├── dashboard/      # דף הבית
│   │   ├── income/         # הכנסות
│   │   ├── expenses/       # הוצאות
│   │   ├── bank/           # תנועות בנק
│   │   ├── budget/         # תקציב
│   │   ├── reports/        # דוחות
│   │   ├── categories/     # קטגוריות
│   │   ├── contacts/       # ספקים ולקוחות
│   │   └── settings/       # הגדרות
│   ├── login/              # דף התחברות
│   └── layout.tsx          # Layout ראשי
├── components/             # קומפוננטות
├── lib/                    # פונקציות עזר
├── hooks/                  # React hooks
├── types/                  # TypeScript types
└── public/                 # קבצים סטטיים
```

---

## 🔧 פיתוח מקומי

```bash
# התקנת תלויות
npm install

# יצירת קובץ סביבה
cp .env.example .env.local
# ערוך את .env.local עם המפתחות שלך

# הרצה בפיתוח
npm run dev
```

פתח http://localhost:3000

---

## 📞 תמיכה

אם יש בעיות:
1. בדוק את ה-Console בדפדפן (F12)
2. בדוק את Vercel Logs
3. ודא שמשתני הסביבה הוגדרו נכון

---

## 📄 רישיון

MIT License

---

נבנה עם ❤️ עבור עסקים ישראליים
