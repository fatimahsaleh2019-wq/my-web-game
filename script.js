// تفعيل الوضع الصارم لمنع الأخطاء وتأمين المتغيرات
"use strict";

// تغليف الكود داخل دالة فورية (IIFE) للحماية تماماً من التلاعب الخارجي
(function () {
    let score = 0;
    let securityLevel = 100;
    let lastClickTime = 0;
    let isGameOver = false;

    // عناصر الواجهة
    const scoreDisplay = document.getElementById("score");
    const securityDisplay = document.getElementById("securityLevel");
    const messageDisplay = document.getElementById("message");
    const investBtn = document.getElementById("investBtn");
    const cleanBtn = document.getElementById("cleanBtn");
    
    // عناصر الحركة
    const customer = document.getElementById("customer");
    const moneyEffect = document.getElementById("moneyEffect");
    const dataEffect = document.getElementById("dataEffect");

    // دالة لتحديث الرسائل آمنة ضد XSS
    function updateMessage(text, isError = false) {
        messageDisplay.textContent = text;
        messageDisplay.style.color = isError ? "#e11d48" : "#475569";
    }

    // دالة لتشغيل مؤثر طيران الأموال/البيانات
    function triggerEffect(effectElement, x, y) {
        // نضع المؤثر في مكان عشوائي قريب من منتصف الساحة
        effectElement.style.left = (40 + Math.random() * 20) + '%';
        effectElement.style.bottom = (60 + Math.random() * 20) + 'px';
        
        // نضيف كلاس الحركة، ثم نزيله بعد ثانية واحدة لإعادة استخدامه
        effectElement.classList.add("float-up");
        setTimeout(() => {
            effectElement.classList.remove("float-up");
        }, 1000);
    }

    // التحقق الأمني من النقر الآلي السريع جداً (Anti-Cheat)
    function isActionAllowed() {
        if (isGameOver) return false;

        const now = Date.now();
        if (now - lastClickTime < 250) { // منع النقر أسرع من 0.25 ثانية
            updateMessage("⚠️ نظام الحماية رصد نشاطاً مريباً! العب بمسؤولية.", true);
            return false;
        }
        lastClickTime = now;
        return true;
    }

    // دالة لفحص حالة اللعبة (Security Check)
    function checkGameStatus() {
        if (securityLevel <= 0) {
            isGameOver = true;
            securityLevel = 0;
            updateMessage("🔴 تعطل المتجر! تم اختراق البيانات لضعف الأمان.", true);
            investBtn.disabled = true;
            cleanBtn.disabled = true;
            customer.classList.remove("walk-animation");
            customer.textContent = "💥"; // رمز التعطل
        }
        securityDisplay.textContent = securityLevel + "%";
    }

    // =========================================
    //              الأحداث الرئيسية
    // =========================================

    // 1. بدء حركة الزبون تلقائياً عند فتح اللعبة
    customer.classList.add("walk-animation");

    // 2. زر الاستثمار التسويقي (+نقاط، -قليل من الأمان)
    investBtn.addEventListener("click", function () {
        if (!isActionAllowed()) return;

        score += 10;
        // الاستثمار السريع قد يقلل التركيز على الأمان قليلاً (لإضافة تحدي إداري)
        securityLevel -= (Math.random() > 0.5 ? 2 : 1); 

        scoreDisplay.textContent = score;
        triggerEffect(moneyEffect); // تفعيل مؤثر طيران النقود
        updateMessage("✅ استثمار ناجح! زادت الأرباح بـ 10 نقاط.");
        checkGameStatus();
    });

    // 3. زر تحليل وتنظيف البيانات (+نقاط، +استقرار، -تكلفة بسيطة)
    cleanBtn.addEventListener("click", function () {
        if (!isActionAllowed()) return;

        score += 15;
        // تحليل البيانات يرفع وعي المتجر ويزيد الأمان قليلاً
        if (securityLevel < 100) securityLevel += (Math.random() > 0.5 ? 3 : 2); 
        if (securityLevel > 100) securityLevel = 100;

        scoreDisplay.textContent = score;
        triggerEffect(dataEffect); // تفعيل مؤثر طيران البيانات
        updateMessage("📊 أحسنت! تحليل البيانات رفع الكفاءة والأمان بـ 15 نقطة.");
        checkGameStatus();
    });

})();
