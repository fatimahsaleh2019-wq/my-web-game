// تفعيل الوضع الصارم لمنع الأخطاء وتأمين المتغيرات
"use strict";

// تغليف الكود داخل دالة فورية (IIFE) لمنع الوصول للمتغيرات والتلاعب بها من المتصفح (Console)
(function () {
    let score = 0;
    let lastClickTime = 0;
    const gameLogs = []; // لتسجيل حركات اللاعب وتحليلها لاحقاً

    // عناصر الواجهة
    const scoreDisplay = document.getElementById("score");
    const messageDisplay = document.getElementById("message");
    const investBtn = document.getElementById("investBtn");
    const cleanBtn = document.getElementById("cleanBtn");

    // دالة آمنة لتحديث النصوص (تمنع ثغرات XSS تماماً)
    function updateMessage(text) {
        messageDisplay.textContent = text;
    }

    // دالة التحقق الأمني لمنع النقر السريع الآلي (Anti-Bot / Rate Limiting)
    function isActionValid() {
        const now = Date.now();
        if (now - lastClickTime < 300) { // منع النقر الأسرع من 0.3 ثانية
            updateMessage("⚠️ تم رصد نقر سريع جداً! يرجى اللعب بشكل طبيعي.");
            return false;
        }
        lastClickTime = now;
        return true;
    }

    // دالة تسجيل الحركات لأغراض تحليل البيانات
    function logAction(actionName, pointsAdded) {
        gameLogs.push({
            timestamp: new Date().toISOString(),
            action: actionName,
            points: pointsAdded,
            totalScore: score
        });
    }

    // حدث زر الاستثمار
    investBtn.addEventListener("click", function () {
        if (!isActionValid()) return;
        score += 10;
        scoreDisplay.textContent = score;
        updateMessage("✅ استثمار ناجح! زادت مبيعات المتجر بمقدار 10 نقاط.");
        logAction("Marketing_Investment", 10);
    });

    // حدث زر تنظيف البيانات
    cleanBtn.addEventListener("click", function () {
        if (!isActionValid()) return;
        score += 15;
        scoreDisplay.textContent = score;
        updateMessage("📊 ممتاز! تنظيف البيانات رفع دقة القرارات بمقدار 15 نقطة.");
        logAction("Data_Cleaning", 15);
    });
})();
