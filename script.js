"use strict";

(function () {
    const canvas = document.getElementById("gameCanvas");
    const ctx = canvas.getContext("2d");

    const balanceDisplay = document.getElementById("balanceDisplay");
    const locationTitle = document.getElementById("locationTitle");
    const locationButtons = document.getElementById("locationButtons");
    const statusLog = document.getElementById("statusLog");

    // حالة اللاعب والمالية بالريال السعودي (محمية داخل النطاق المغلق)
    let balanceSAR = 10000;
    let dashOffset = 0; // لتحريك الخطوط المتقطعة

    // إحداثيات وحركة اللاعب (المدير التنفيذي)
    const player = {
        x: 500,
        y: 300,
        targetX: 500,
        targetY: 300,
        speed: 4,
        radius: 14
    };

    // تعريف المباني: البنك، المتجر، والشركات الأربع
    // النسب (rx, ry) تجعل الخريطة متجاوبة مع أي حجم شاشة (جوال أو كمبيوتر)
    const buildings = [
        {
            id: "bank",
            name: "🏦 البنك الاستثماري المركزي",
            type: "bank",
            rx: 0.50, ry: 0.22,
            w: 170, h: 95,
            color: "#1e3a8a",
            border: "#3b82f6"
        },
        {
            id: "store",
            name: "🏪 المتجر التجاري الذكي",
            type: "store",
            rx: 0.50, ry: 0.78,
            w: 170, h: 95,
            color: "#7c2d12",
            border: "#f97316",
            storeLevel: 1
        },
        {
            id: "edu",
            name: "شركة التعلم",
            type: "company",
            rx: 0.18, ry: 0.25,
            w: 220, h: 145,
            color: "#064e3b",
            border: "#10b981",
            invested: 0,
            employees: 5 // 5 موظفين + 1 مسؤول
        },
        {
            id: "mgmt",
            name: "شركة الإدارة",
            type: "company",
            rx: 0.82, ry: 0.25,
            w: 220, h: 145,
            color: "#312e81",
            border: "#6366f1",
            invested: 0,
            employees: 5
        },
        {
            id: "marine",
            name: "شركة الواردات البحرية",
            type: "company",
            rx: 0.18, ry: 0.75,
            w: 220, h: 145,
            color: "#164e63",
            border: "#06b6d4",
            invested: 0,
            employees: 5
        },
        {
            id: "saudi_pub",
            name: "شركة الإصدارات السعودية",
            type: "company",
            rx: 0.82, ry: 0.75,
            w: 220, h: 145,
            color: "#4c1d95",
            border: "#a855f7",
            invested: 0,
            employees: 5
        }
    ];

    // شبكة التواصل عن بعد بين الشركات والبنك (خطوط متقطعة)
    const connections = [
        ["edu", "mgmt"],
        ["marine", "saudi_pub"],
        ["edu", "marine"],
        ["mgmt", "saudi_pub"],
        ["edu", "bank"],
        ["mgmt", "bank"],
        ["marine", "bank"],
        ["saudi_pub", "bank"]
    ];

    // ضبط أبعاد لوحة الرسم لتطابق الشاشة بدقة
    function resizeCanvas() {
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
    }
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    // تحديث النصوص بأمان تام لمنع ثغرات XSS
    function setSafeText(element, text) {
        element.textContent = text;
    }

    function updateBalanceUI() {
        setSafeText(balanceDisplay, balanceSAR.toLocaleString("en-US"));
    }

    // التحكم بالماوس واللمس للتحرك في أي مكان
    function setDestination(clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        const clickX = clientX - rect.left;
        const clickY = clientY - rect.top;

        player.targetX = Math.max(20, Math.min(canvas.width - 20, clickX));
        player.targetY = Math.max(20, Math.min(canvas.height - 20, clickY));
    }

    canvas.addEventListener("mousedown", (e) => setDestination(e.clientX, e.clientY));
    canvas.addEventListener("touchstart", (e) => {
        if (e.touches.length > 0) {
            setDestination(e.touches[0].clientX, e.touches[0].clientY);
        }
    }, { passive: true });

    // حساب الإحداثيات الفعلية لكل مبنى
    function getBuildingRect(b) {
        const cx = b.rx * canvas.width;
        const cy = b.ry * canvas.height;
        return {
            cx: cx,
            cy: cy,
            x: cx - b.w / 2,
            y: cy - b.h / 2,
            w: b.w,
            h: b.h
        };
    }

    // تحديث حركة اللاعب
    function updatePlayer() {
        const dx = player.targetX - player.x;
        const dy = player.targetY - player.y;
        const dist = Math.hypot(dx, dy);

        if (dist > player.speed) {
            player.x += (dx / dist) * player.speed;
            player.y += (dy / dist) * player.speed;
        } else {
            player.x = player.targetX;
            player.y = player.targetY;
        }
    }

    // فحص اقتراب اللاعب من أي مبنى لإظهار أزرار التفاعل
    let currentBuildingId = null;
    function checkProximity() {
        let found = null;
        for (const b of buildings) {
            const r = getBuildingRect(b);
            if (
                player.x >= r.x - 15 &&
                player.x <= r.x + r.w + 15 &&
                player.y >= r.y - 15 &&
                player.y <= r.y + r.h + 15
            ) {
                found = b;
                break;
            }
        }

        if (found && found.id !== currentBuildingId) {
            currentBuildingId = found.id;
            renderActionPanel(found);
        } else if (!found && currentBuildingId !== null) {
            currentBuildingId = null;
            setSafeText(locationTitle, "اضغط أو المس أي مكان في الخريطة للتحرك 🚶‍♂️");
            locationButtons.innerHTML = "";
        }
    }

    // بناء أزرار التفاعل داخل البنك أو المتجر أو الشركات
    function renderActionPanel(b) {
        locationButtons.innerHTML = "";

        if (b.type === "bank") {
            setSafeText(locationTitle, "🏦 البنك الاستثماري: افتح محفظة واستثمر بالريال السعودي");
            const btn = document.createElement("button");
            btn.className = "invest-btn";
            setSafeText(btn, "فتح حساب استثماري (+500 ر.س عائد ترحيبي)");
            btn.onclick = () => {
                balanceSAR += 500;
                updateBalanceUI();
                setSafeText(statusLog, "✅ تم تفعيل حسابك الاستثماري بالريال السعودي وإيداع 500 ر.س!");
            };
            locationButtons.appendChild(btn);
        } else if (b.type === "store") {
            setSafeText(locationTitle, `🏪 المتجر التجاري (المستوى ${b.storeLevel})`);
            const btn = document.createElement("button");
            setSafeText(btn, "تطوير المتجر (-1,500 ر.س)");
            btn.onclick = () => {
                if (balanceSAR >= 1500) {
                    balanceSAR -= 1500;
                    b.storeLevel += 1;
                    updateBalanceUI();
                    renderActionPanel(b);
                    setSafeText(statusLog, `🛍️ تم تطوير المتجر للمستوى ${b.storeLevel}! زادت أرباحك الدورية.`);
                } else {
                    setSafeText(statusLog, "⚠️ رصيدك بالريال غير كافٍ لتطوير المتجر!");
                }
            };
            locationButtons.appendChild(btn);
        } else if (b.type === "company") {
            setSafeText(locationTitle, `🏢 ${b.name} | استثمارك: ${b.invested.toLocaleString()} ر.س | الموظفون: ${b.employees} + 1 مسؤول`);

            // زر الاستثمار في الشركة
            const investBtn = document.createElement("button");
            investBtn.className = "invest-btn";
            setSafeText(investBtn, "استثمر 1,000 ر.س");
            investBtn.onclick = () => {
                if (balanceSAR >= 1000) {
                    balanceSAR -= 1000;
                    b.invested += 1000;
                    updateBalanceUI();
                    renderActionPanel(b);
                    setSafeText(statusLog, `📈 استثمرت 1,000 ر.س في ${b.name}. ستصلك أرباح كل بضع ثوانٍ!`);
                } else {
                    setSafeText(statusLog, "⚠️ لا يوجد رصيد كافٍ بالريال للاستثمار.");
                }
            };

            // زر إضافة موظف جديد بمكتب
            const hireBtn = document.createElement("button");
            setSafeText(hireBtn, "توظيف موظف بمكتب (-800 ر.س)");
            hireBtn.onclick = () => {
                if (b.employees >= 8) {
                    setSafeText(statusLog, "ℹ️ الشركة وصلت للحد الأقصى للمكاتب المتاحة!");
                    return;
                }
                if (balanceSAR >= 800) {
                    balanceSAR -= 800;
                    b.employees += 1;
                    updateBalanceUI();
                    renderActionPanel(b);
                    setSafeText(statusLog, `👨‍💻 تم تعيين موظف جديد وتجهيز مكتبه داخل ${b.name}!`);
                } else {
                    setSafeText(statusLog, "⚠️ تحتاج إلى 800 ر.س لتوظيف موظف جديد.");
                }
            };

            locationButtons.appendChild(investBtn);
            locationButtons.appendChild(hireBtn);
        }
    }

    // توليد أرباح تلقائية بالريال كل 4 ثوانٍ بناءً على الاستثمارات والمتجر
    setInterval(() => {
        let passiveIncome = 0;
        buildings.forEach((b) => {
            if (b.type === "company" && b.invested > 0) {
                passiveIncome += Math.round((b.invested * 0.08) + (b.employees * 20));
            }
            if (b.type === "store") {
                passiveIncome += b.storeLevel * 100;
            }
        });

        if (passiveIncome > 0) {
            balanceSAR += passiveIncome;
            updateBalanceUI();
            setSafeText(statusLog, `💰 أرباح استثماراتك والمتجر: +${passiveIncome.toLocaleString()} ر.س أضيفت لحسابك!`);
        }
    }, 4000);

    // رسم الشبكة المتقطعة للتواصل عن بعد
    function drawNetworkLines() {
        dashOffset -= 0.6; // حركة النبضات على الخط المتقطع
        ctx.save();
        ctx.setLineDash([10, 8]); // شكل الخط المتقطع
        ctx.lineDashOffset = dashOffset;
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "#0284c7";

        connections.forEach(([idA, idB]) => {
            const bA = buildings.find((b) => b.id === idA);
            const bB = buildings.find((b) => b.id === idB);
            if (bA && bB) {
                const rA = getBuildingRect(bA);
                const rB = getBuildingRect(bB);
                ctx.beginPath();
                ctx.moveTo(rA.cx, rA.cy);
                ctx.lineTo(rB.cx, rB.cy);
                ctx.stroke();
            }
        });
        ctx.restore();
    }

    // رسم المباني والشركات والمكاتب والموظفين بداخلها
    function drawBuildings() {
        buildings.forEach((b) => {
            const r = getBuildingRect(b);

            // أرضية المبنى
            ctx.fillStyle = b.color;
            ctx.strokeStyle = b.border;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.roundRect(r.x, r.y, r.w, r.h, 12);
            ctx.fill();
            ctx.stroke();

            // اسم المبنى في الأعلى
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 13px Tahoma";
            ctx.textAlign = "center";
            ctx.fillText(b.name, r.cx, r.y + 20);

            if (b.type === "company") {
                // رسم مكتب المسؤول (في الأعلى)
                drawDeskAndWorker(r.cx, r.y + 42, "#facc15", "👑");

                // رسم 5 موظفين (أو أكثر عند التوظيف) لكل موظف مكتب يعمل عليه
                const cols = 3;
                const startX = r.x + 42;
                const startY = r.y + 82;
                const gapX = 68;
                const gapY = 38;

                for (let i = 0; i < b.employees; i++) {
                    const col = i % cols;
                    const row = Math.floor(i / cols);
                    const wx = startX + col * gapX;
                    const wy = startY + row * gapY;
                    drawDeskAndWorker(wx, wy, "#38bdf8", "💻");
                }
            } else if (b.type === "bank") {
                ctx.fillStyle = "#93c5fd";
                ctx.font = "12px Tahoma";
                ctx.fillText("حسابات الاستثمار (SAR)", r.cx, r.y + 52);
                ctx.fillText("💳 تحويلات فورية", r.cx, r.y + 74);
            } else if (b.type === "store") {
                ctx.fillStyle = "#fed7aa";
                ctx.font = "12px Tahoma";
                ctx.fillText(`المستوى: ${b.storeLevel} | مبيعات نشطة`, r.cx, r.y + 52);
                ctx.fillText("🛒 نقاط بيع ذكية", r.cx, r.y + 74);
            }
        });
    }

    // دالة رسم المكتب والموظف الجالس عليه
    function drawDeskAndWorker(x, y, shirtColor, icon) {
        // المكتب (مستطيل بني فاتح)
        ctx.fillStyle = "#d97706";
        ctx.fillRect(x - 16, y - 6, 32, 12);

        // شاشة الكمبيوتر على المكتب
        ctx.fillStyle = "#e2e8f0";
        ctx.fillRect(x - 6, y - 4, 12, 6);

        // الموظف (دائرة تمثل الرأس والكتفين)
        ctx.fillStyle = shirtColor;
        ctx.beginPath();
        ctx.arc(x, y + 11, 6, 0, Math.PI * 2);
        ctx.fill();
    }

    // رسم اللاعب (المدير) ونقطة الهدف عند اللمس/النقر
    function drawPlayer() {
        // دائرة الهدف على الأرض
        if (Math.hypot(player.targetX - player.x, player.targetY - player.y) > 5) {
            ctx.strokeStyle = "#ef4444";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(player.targetX, player.targetY, 8, 0, Math.PI * 2);
            ctx.stroke();
        }

        // ظل اللاعب
        ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
        ctx.beginPath();
        ctx.ellipse(player.x, player.y + 12, 12, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // جسم اللاعب
        ctx.fillStyle = "#ef4444";
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // أيقونة المدير فوق الشخصية
        ctx.font = "16px Tahoma";
        ctx.textAlign = "center";
        ctx.fillText("🧑‍💼", player.x, player.y + 5);
    }

    // حلقة الرسم المستمرة (60 إطار في الثانية)
    function gameLoop() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // خلفية أرضية الخريطة (شبكة هندسية خفيفة)
        ctx.strokeStyle = "#e2e8f0";
        ctx.lineWidth = 1;
        for (let x = 0; x < canvas.width; x += 40) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += 40) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }

        drawNetworkLines();
        drawBuildings();
        updatePlayer();
        checkProximity();
        drawPlayer();

        requestAnimationFrame(gameLoop);
    }

    updateBalanceUI();
    gameLoop();
})();
