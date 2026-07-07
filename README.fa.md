[English](README.md) | **فارسی**

# claude-usage-plugin

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](package.json)
[![Version](https://img.shields.io/badge/version-2.1.0-blue)](package.json)

یک **پلاگین Claude Code** با یک وظیفه: گزارش مصرف **۵ ساعته** و **هفتگی** حساب
کلود شما — همان اعداد **رسمی** که Claude Code خودش در نوار وضعیت نشان می‌دهد،
نه یک تخمین. این پلاگین **هیچ محدودیتی اعمال نمی‌کند**. نه آستانه‌ای وجود دارد،
نه منطق رد کردن، و هیچ چیزی هرگز مسدود نمی‌شود. فقط می‌خواند و گزارش می‌دهد.

## فهرست مطالب

- [نحوه عملکرد](#نحوه-عملکرد)
- [ابزارها](#ابزارها)
  - [check\_usage](#check_usage)
  - [check\_data\_status](#check_data_status)
- [پیش‌نیازها](#پیش‌نیازها)
- [نصب](#نصب)
  - [راه‌اندازی یک‌باره statusLine](#راه‌اندازی-یک‌باره-statusline-برای-دریافت-اعداد-رسمی)
  - [هوک اختیاری PostToolUse](#هوک-اختیاری-posttooluse)
- [یادداشت‌های طراحی](#یادداشت‌های-طراحی)
- [مجوز](#مجوز)

## نحوه عملکرد

Claude Code (نسخه ۲.۱.۸۰ به بالا، پلن Pro/Max) یک پیلود JSON حاوی
`rate_limits.{five_hour,seven_day}` — هر کدام با `used_percentage` رسمی و
`resets_at` — را به هر دستوری که به‌عنوان هوک **statusLine** ثبت شده، در هر
رندر نوار وضعیت ارسال می‌کند. این پلاگین سه جزء دارد:

- **`capture-statusline.js`** — هوک statusLine. در هر رندر، بلاک رسمی
  `rate_limits` را در `~/.usage-guardian-mcp/statusline-latest.json` ذخیره
  می‌کند و خط وضعیت را چاپ می‌کند (مثلاً `Opus 4.8 · 5h 86% · 7d 80%`). بدون
  تماس شبکه، هرگز خطا نمی‌دهد و هرگز نوار وضعیت را خالی نمی‌گذارد.
- **`index.js`** — سرور MCP. آن capture را می‌خواند و به‌صورت دو ابزار
  بدون‌آرگومان در دسترس قرار می‌دهد.
- **`usage-hook.js`** — هوک اختیاری PostToolUse. بعد از هر فراخوانی ابزار
  اجرا می‌شود و یک خلاصه کوتاه مصرف را به context کلود تزریق می‌کند.

بدون تماس شبکه، بدون کوکی نشست، بدون scraping — داده‌ها مستقیماً از Claude Code
می‌آیند.

> **چرا statusLine و نه یک تایمر؟** `rate_limits` رسمی فقط به یک دستور
> statusLine تحویل داده می‌شوند. یک تایمر پس‌زمینه هیچ راهی برای دریافت آن‌ها
> ندارد و فقط می‌تواند مصرف را از تعداد توکن‌های محلی *تخمین* بزند. برای اینکه
> عدد با آنچه Claude Code نشان می‌دهد مطابقت داشته باشد، پلاگین از statusLine
> استفاده می‌کند. در هر رندر (زیر یک ثانیه در حین فعالیت) به‌روزرسانی می‌شود.

## ابزارها

| ابزار | ورودی | خروجی |
|---|---|---|
| `check_usage` | هیچ | `{"usage_percent": 86, "resets_at": "...", "seven_day_percent": 80, "seven_day_resets_at": "...", "stale": false}` — `usage_percent`/`resets_at` برای بازه ۵ ساعته؛ `seven_day_*` برای بازه هفتگی. |
| `check_data_status` | هیچ | `{"authenticated": true}` یا `{"authenticated": false}` — آیا یک capture موجود و تازه (به‌روزشده در ۱۰ دقیقه گذشته) است؟ |

خطاهای ساختارمند به‌جای شکست‌های خاموش:

- `{"error": "statusline_not_configured"}` — هوک statusLine هنوز تنظیم نشده (راه‌اندازی زیر را ببینید).
- `{"error": "rate_limits_unavailable"}` — یک capture وجود دارد اما Claude Code گزارش `rate_limits` نمی‌دهد (نیاز به نسخه ۲.۱.۸۰+ با پلن Pro/Max دارد).

### `check_usage`

فایل `~/.usage-guardian-mcp/statusline-latest.json` نوشته‌شده توسط هوک
statusLine را می‌خواند و یک شیء JSON برمی‌گرداند:

```json
{
  "usage_percent": 86,
  "resets_at": "2025-07-07T18:00:00.000Z",
  "seven_day_percent": 80,
  "seven_day_resets_at": "2025-07-13T00:00:00.000Z",
  "stale": false
}
```

`stale: true` یعنی capture قدیمی‌تر از ۱۰ دقیقه است — هیچ نشست فعالی اخیراً
آن را به‌روز نکرده.

### `check_data_status`

یک poll آمادگی سریع: وقتی capture موجود و تازه است `{"authenticated": true}`
برمی‌گرداند، در غیر این صورت `{"authenticated": false}`. مفید است که پیش از
`check_usage` اجرا شود تا از خطاهای پر سروصدا جلوگیری شود.

## پیش‌نیازها

- [Node.js](https://nodejs.org) نسخه ۱۸ یا بالاتر
- Claude Code نسخه ۲.۱.۸۰+ با **پلن Pro یا Max** (نسخه‌های قدیمی‌تر / پلن‌های
  دیگر `rate_limits` را در پیلود statusLine ندارند)

## نصب

```bash
# ۱. کلون و نصب وابستگی‌ها
git clone https://github.com/MatinMHF/claude-usage-plugin.git
cd claude-usage-plugin
npm install

# ۲. ثبت سرور MCP در Claude Code
claude mcp add claude-usage-plugin -s user -- node /path/to/claude-usage-plugin/index.js
```

یا به‌صورت دستی به `~/.claude/claude_desktop_config.json` اضافه کنید:

```json
{
  "mcpServers": {
    "claude-usage-plugin": {
      "command": "node",
      "args": ["/path/to/claude-usage-plugin/index.js"]
    }
  }
}
```

### راه‌اندازی یک‌باره statusLine (برای دریافت اعداد رسمی)

سرور MCP فقط آن capture را *می‌خواند*؛ هوک statusLine آن را تازه نگه می‌دارد.
چون Claude Code داده‌های رسمی `rate_limits` را فقط به یک دستور statusLine
تحویل می‌دهد — و statusLine یک جزء پلاگین‌محور نیست — این را یک‌بار به
`~/.claude/settings.json` اضافه کنید:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node \"/path/to/claude-usage-plugin/capture-statusline.js\""
  }
}
```

> **کاربران ویندوز:** از **اسلش رو به جلو** در مسیر استفاده کنید —
> `C:/Users/you/claude-usage-plugin/capture-statusline.js` — Claude Code این
> رشته را با تقسیم‌بندی کلمه‌ای به سبک POSIX تجزیه می‌کند و بک‌اسلش‌ها خراب
> می‌شوند.

**از قبل statusLine دارید؟** آن را جایگزین نکنید — stdin را به هر دو دستور
زنجیر کنید، یا فراخوانی `captureStatusline()` از `official.js` را به اسکریپت
موجود خود بیفزایید.

Claude Code را ریستارت کنید، یک پیام ارسال کنید تا هوک فعال شود، سپس
`check_usage` اعداد رسمی زنده شما را گزارش می‌دهد.

### هوک اختیاری PostToolUse

`usage-hook.js` یک هوک PostToolUse است که یک خط کوتاه مصرف
(`Claude usage — 5h 86% · 7d 80%`) را بعد از هر فراخوانی ابزار به context
کلود تزریق می‌کند. برای فعال‌سازی، به `~/.claude/settings.json` اضافه کنید:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "node \"/path/to/claude-usage-plugin/usage-hook.js\""
          }
        ]
      }
    ]
  }
}
```

این هوک **هیچ محدودیتی اعمال نمی‌کند** و هیچ فراخوانی ابزاری را مسدود
نمی‌کند — همیشه با کد ۰ خارج می‌شود. صرفاً اطلاعاتی است.

## یادداشت‌های طراحی

- **رسمی، نه تخمینی.** اعداد از `rate_limits` خود Claude Code می‌آیند — همان
  داده‌ای که در نوار وضعیت نمایش داده می‌شود.
- **بدون محدودیت.** پلاگین فقط ثبت و گزارش می‌کند — نه آستانه، نه بلاک، نه
  اثر جانبی.
- **توکن‌های حداقلی.** دو ابزار بدون‌آرگومان که JSON فشرده برمی‌گردانند؛ هوک
  statusLine صرفاً harness است و چیزی به context مدل اضافه نمی‌کند.
- **بدون تماس شبکه.** `index.js` فقط یک فایل JSON محلی می‌خواند. بدون کوکی،
  بدون scraping، بدون چالش Cloudflare.
- **نوشتن اتمیک.** Capture در یک فایل موقت منحصربه‌فرد (pid-unique) نوشته و
  به‌جای نهایی rename می‌شود، پس یک خواننده همزمان هرگز فایل نیمه‌نوشته‌ای
  نمی‌بیند.
- **هرگز نوار وضعیت را خالی نمی‌گذارد.** شکست‌های capture و قالب‌بندی در
  `capture-statusline.js` به‌صورت خاموش بلعیده می‌شوند.

## مجوز

[MIT](LICENSE)
