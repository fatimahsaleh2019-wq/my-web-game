"use strict";

(function () {
    const canvas = document.getElementById("gameCanvas");
    const ctx = canvas.getContext("2d");

    // عناصر الواجهة
    const balanceDisplay = document.getElementById("balanceDisplay");
    const ageDisplay = document.getElementById("ageDisplay");
    const expDisplay = document.getElementById("expDisplay");
    const stockDisplay = document.getElementById("stockDisplay");
    const taxDisplay = document.getElementById("taxDisplay");
    const loansDisplay = document.getElementById("loansDisplay");
    const locationTitle = document.getElementById("locationTitle");
    const locationButtons = document.getElementById("locationButtons");
    const statusLog = document.getElementById("statusLog");
    const endModal = document.getElementById("endModal");
    const endTitle = document.getElementById("endTitle");
    const endDesc = document.getElementById("endDesc");

    // متغيرات حالة اللعبة المحمية
    let balanceSAR = 15000;
    let playerAge = 25;         // كل دقيقة = سنة
    let playerExp = 1;          // يبدأ بخبرة سنة
    let isRetired = false;
    let gameOver = false;
    let gameWon = false;

    // حالة عقد شركة التعلم (دقيقتين = سنتين)
    let eduContractActive = false;
    let eduContractSecondsLeft = 0;

    // حالة المتجر والضرائب والقروض
    let storeStock = 200000;
    let taxRate = 3.0;          // تبدأ 3% وإذا تجاوزت 5% يتناقص المخزون
    let bankLoans = 0;          // الحد الأقصى 3 قروض

    // حالة سيارة النقل من شركة الواردات إلى شركة التعلم
    const truck = {
        active: false,
        x: 0,
        y: 0,
        targetX: 0,
        targetY: 0,
        speed: 3.2
    };

    let dashOffset = 0;

    // اللاعب (المدير)
    const player = {
        x: 500,
        y: 300,
        targetX: 500,
        targetY: 300,
        speed: 4.5,
        radius: 13
    };

    // المباني: البنك، المتجر، والشركات الأربع
    const buildings = [
        {
            id: "bank",
            name: "🏦 البنك المركزي",
            type: "bank",
            rx: 0.50, ry: 0.16,
            w: 155, h: 75,
            color: "#1e3a8a", border: "#3b82f6"
        },
        {
            id: "store",
            name: "🏪 المتجر الموزع",
            type: "store",
            rx: 0.50, ry: 0.84,
            w: 175, h: 80,
            color: "#7c2d12", border: "#f97316"
        },
        {
            id: "edu",
            name: "شركة التعلم",
            type: "company",
            rx: 0.17, ry: 0.24,
            w: 225, h: 145,
            color: "#064e3b", border: "#10b981",
            budget: 25000,
            fame: 10000,
            quality: 1000,
            employees: 5
        },
        {
            id: "mgmt",
            name: "شركة الإدارة",
            type: "company",
            rx: 0.83, ry: 0.24,
            w: 225, h: 145,
            color: "#312e81", border: "#6366f1",
            budget: 35000,
            fame: 15000,
            quality: 1000,
            employees: 5
        },
        {
            id: "marine",
            name: "شركة الواردات البحرية",
            type: "company",
            rx: 0.17, ry: 0.76,
            w: 225, h: 145,
            color: "#164e63", border: "#06b6d4",
            budget: 40000,
            fame: 12000,
            quality: 1000,
            employees: 5
        },
        {
            id: "saudi_pub",
            name: "شركة الإصدارات السعودية",
            type: "company",
            rx: 0.83, ry: 0.76,
            w: 225, h: 145,
            color: "#4c1d95", border: "#a855f7",
            budget: 32000,
            fame: 14000,
            quality: 1000,
            employees: 5
        }
    ];

    function setSafeText(el, txt) {
        el.textContent = txt;
    }

    function updateTopUI() {
        setSafeText(balanceDisplay, Math.floor(balanceSAR).toLocaleString("en-US"));
        setSafeText(ageDisplay, playerAge);
        setSafeText(expDisplay, playerExp);
        setSafeText(stockDisplay, Math.floor(storeStock).toLocaleString("en-US"));
        setSafeText(taxDisplay, taxRate.toFixed(1));
        setSafeText(loansDisplay, bankLoans);
    }

    function resizeCanvas() {
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
    }
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    // التحرك بالماوس أو اللمس
    function setDestination(clientX, clientY) {
        if (gameOver || gameWon) return;
        const rect = canvas.getBoundingClientRect();
        player.targetX = Math.max(20, Math.min(canvas.width - 20, clientX - rect.left));
        player.targetY = Math.max(20, Math.min(canvas.height - 20, clientY - rect.top));
    }

    canvas.addEventListener("mousedown", (e) => setDestination(e.clientX, e.clientY));
    canvas.addEventListener("touchstart", (e) => {
        if (e.touches.length > 0) setDestination(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });

    function getBuildingRect(b) {
        const scale = gameWon ? 1.12 : 1.0;
        const w = b.w * scale;
        const h = b.h * scale;
        const cx = b.rx * canvas.width;
        const cy = b.ry * canvas.height;
        return { cx, cy, x: cx - w / 2, y: cy - h / 2, w, h };
    }

    // تحديث حركة اللاعب والسيارة
    function updateEntities() {
        // حركة اللاعب
        const dx = player.targetX - player.x;
        const dy = player.targetY - player.y;
        const dist = Math.hypot(dx, dy);
        if (dist > player.speed) {
            player.x += (dx / dist) * player.speed;
            player.y += (dy / dist) * player.speed;
        }

        // حركة سيارة التوصيل من شركة الواردات إلى شركة التعلم
        if (truck.active) {
            const tdx = truck.targetX - truck.x;
            const tdy = truck.targetY - truck.y;
            const tdist = Math.hypot(tdx, tdy);
            if (tdist > truck.speed) {
                truck.x += (tdx / tdist) * truck.speed;
                truck.y += (tdy / tdist) * truck.speed;
            } else {
                truck.active = false;
                const eduComp = buildings.find(b => b.id === "edu");
                eduComp.budget += 12000;
                balanceSAR += 2500;
                updateTopUI();
                setSafeText(statusLog, "🚚 وصلت السيارة لشركة التعلم! أُضيف +12,000 لميزانيتها و +2,500 ر.س مكافأة لك.");
                if (currentBuildingId === "edu") renderActionPanel(eduComp);
            }
        }
    }

    let currentBuildingId = null;
    function checkProximity() {
        let found = null;
        for (const b of buildings) {
            const r = getBuildingRect(b);
            if (player.x >= r.x - 12 && player.x <= r.x + r.w + 12 &&
                player.y >= r.y - 12 && player.y <= r.y + r.h + 12) {
                found = b;
                break;
            }
        }

        if (found && found.id !== currentBuildingId) {
            currentBuildingId = found.id;
            renderActionPanel(found);
        } else if (!found && currentBuildingId !== null) {
            currentBuildingId = null;
            setSafeText(locationTitle, "اضغط أو المس الخريطة للتحرك 🚶‍♂️ | الهدف: 9 مليون ر.س في كل شركة");
            locationButtons.innerHTML = "";
        }
    }

    // أزرار التفاعل الخاصة بكل مبنى
    function renderActionPanel(b) {
        locationButtons.innerHTML = "";

        if (b.id === "edu") {
            setSafeText(locationTitle, `🎓 ${b.name} | الميزانية: ${b.budget.toLocaleString()} | الشهرة: ${b.fame.toLocaleString()} | الجودة: ${b.quality.toLocaleString()}`);
            
            const applyBtn = document.createElement("button");
            applyBtn.className = "success-btn";
            if (eduContractActive) {
                setSafeText(applyBtn, `عقدك سارٍ (${eduContractSecondsLeft} ثانية متبقية)`);
                applyBtn.disabled = true;
            } else {
                setSafeText(applyBtn, "توظيف سنتين (دقيقتين) براتب 7,500 ر.س (رسوم 2,000)");
                applyBtn.onclick = () => {
                    if (playerExp < 1) {
                        setSafeText(statusLog, "⚠️ تشترط شركة التعلم خبرة سنة على الأقل!");
                        return;
                    }
                    if (balanceSAR < 2000) {
                        setSafeText(statusLog, "⚠️ تحتاج 2,000 ر.س لدفع رسوم التوظيف!");
                        return;
                    }
                    balanceSAR -= 2000;
                    b.budget += 2000;
                    eduContractActive = true;
                    eduContractSecondsLeft = 120; // دقيقتين = سنتين
                    updateTopUI();
                    renderActionPanel(b);
                    setSafeText(statusLog, "🎓 تم توظيفك في شركة التعلم لمدة سنتين (دقيقتين) براتب 7,500 ر.س وخبرة +5 سنوات!");
                };
            }
            locationButtons.appendChild(applyBtn);

            // زر تسريع نمو الشركة للاستثمار الكبير (للوصول لـ 9 مليون)
            const boostBtn = document.createElement("button");
            setSafeText(boostBtn, "ضخ استثمار وتوسيع (+1,500,000 ميزانية)");
            boostBtn.onclick = () => {
                if (balanceSAR >= 5000) {
                    balanceSAR -= 5000;
                    b.budget += 1500000;
                    updateTopUI();
                    renderActionPanel(b);
                    checkWinCondition();
                } else {
                    setSafeText(statusLog, "⚠️ تحتاج 5,000 ر.س لتمويل التوسع.");
                }
            };
            locationButtons.appendChild(boostBtn);

        } else if (b.id === "marine") {
            setSafeText(locationTitle, `🚢 ${b.name} | الميزانية: ${b.budget.toLocaleString()} | الشهرة: ${b.fame.toLocaleString()}`);
            
            const driveBtn = document.createElement("button");
            driveBtn.className = "warn-btn";
            setSafeText(driveBtn, truck.active ? "السيارة في الطريق 🚚..." : "توظيف سائق: توصيل ميزانية لشركة التعلم 🚚");
            driveBtn.disabled = truck.active;
            driveBtn.onclick = () => {
                const startR = getBuildingRect(b);
                const endR = getBuildingRect(buildings.find(x => x.id === "edu"));
                truck.x = startR.cx;
                truck.y = startR.cy;
                truck.targetX = endR.cx;
                truck.targetY = endR.cy;
                truck.active = true;
                renderActionPanel(b);
                setSafeText(statusLog, "🚚 انطلقت سيارتك من شركة الواردات نحو شركة التعلم لإضافة ميزانية!");
            };
            locationButtons.appendChild(driveBtn);

            const boostBtn = document.createElement("button");
            setSafeText(boostBtn, "توسيع الأسطول (+1,500,000 ميزانية)");
            boostBtn.onclick = () => {
                if (balanceSAR >= 5000) {
                    balanceSAR -= 5000;
                    b.budget += 1500000;
                    updateTopUI();
                    renderActionPanel(b);
                    checkWinCondition();
                }
            };
            locationButtons.appendChild(boostBtn);

        } else if (b.type === "company") {
            setSafeText(locationTitle, `🏢 ${b.name} | الميزانية: ${b.budget.toLocaleString()} | الشهرة: ${b.fame.toLocaleString()} | الجودة: ${b.quality.toLocaleString()}`);
            
            const boostBtn = document.createElement("button");
            boostBtn.className = "success-btn";
            setSafeText(boostBtn, "استثمار وتوسيع (+1,500,000 ميزانية)");
            boostBtn.onclick = () => {
                if (balanceSAR >= 5000) {
                    balanceSAR -= 5000;
                    b.budget += 1500000;
                    updateTopUI();
                    renderActionPanel(b);
                    checkWinCondition();
                } else {
                    setSafeText(statusLog, "⚠️ تحتاج 5,000 ر.س للاستثمار في الشركة.");
                }
            };
            locationButtons.appendChild(boostBtn);

        } else if (b.id === "store") {
            setSafeText(locationTitle, `🏪 المتجر الموزع | المخزون: ${Math.floor(storeStock).toLocaleString()} منتج | الضريبة: ${taxRate.toFixed(1)}%`);
            
            const restockBtn = document.createElement("button");
            restockBtn.className = "success-btn";
            setSafeText(restockBtn, "توريد +200,000 منتج وخفض الضريبة (-3,000 ر.س)");
            restockBtn.onclick = () => {
                if (balanceSAR >= 3000) {
                    balanceSAR -= 3000;
                    storeStock += 200000;
                    taxRate = Math.max(2.0, taxRate - 1.5);
                    updateTopUI();
                    renderActionPanel(b);
                    setSafeText(statusLog, "📦 تم تجديد مخزون المتجر بـ 200,000 منتج وتخفيض الضريبة!");
                } else {
                    setSafeText(statusLog, "⚠️ رصيدك غير كافٍ لتوريد البضائع.");
                }
            };
            locationButtons.appendChild(restockBtn);

        } else if (b.id === "bank") {
            setSafeText(locationTitle, `🏦 البنك المركزي | القروض المسجلة على المتجر: ${bankLoans} من 3`);
            
            const payLoanBtn = document.createElement("button");
            payLoanBtn.className = "warn-btn";
            setSafeText(payLoanBtn, "سداد قرض واحد عن المتجر (-10,000 ر.س)");
            payLoanBtn.onclick = () => {
                if (bankLoans > 0 && balanceSAR >= 10000) {
                    balanceSAR -= 10000;
                    bankLoans -= 1;
                    updateTopUI();
                    renderActionPanel(b);
                    setSafeText(statusLog, "✅ تم سداد أحد قروض المتجر بنجاح وحمايته من الإغلاق!");
                } else {
                    setSafeText(statusLog, "ℹ️ لا توجد قروض أو رصيدك أقل من 10,000 ر.س.");
                }
            };
            locationButtons.appendChild(payLoanBtn);
        }
    }

    // =========================================================
    // الدورة الزمنية (كل 1 ثانية): العمر، العقود، ودورات الشركات
    // =========================================================
    setInterval(() => {
        if (gameOver || gameWon) return;

        // 1. تتبع عقد شركة التعلم (سنتين = 120 ثانية)
        if (eduContractActive) {
            eduContractSecondsLeft -= 1;
            if (eduContractSecondsLeft % 15 === 0) {
                balanceSAR += 7500; // صرف الراتب
                setSafeText(statusLog, "💵 تم إيداع راتبك من شركة التعلم: +7,500 ر.س!");
            }
            if (eduContractSecondsLeft <= 0) {
                eduContractActive = false;
                playerExp += 5; // إضافة خبرة 5 سنوات
                setSafeText(statusLog, "🎉 أتممت سنتين في شركة التعلم! تمت إضافة +5 سنوات خبرة لملفك.");
            }
            if (currentBuildingId === "edu") {
                renderActionPanel(buildings.find(b => b.id === "edu"));
            }
        }

        // 2. دورة عمل الشركات الأربع (الميزانية > 30 ألف -> مهارات -> معلومات -> +500 شهرة -> زيادة ميزانية)
        buildings.forEach((b) => {
            if (b.type === "company") {
                if (b.budget > 30000) {
                    // الموظفون يكتسبون مهارات وينتجون معلومات ترفع الشهرة 500 نقطة
                    b.fame += 500;
                }
                if (b.fame > 30000) {
                    // الشهرة تزيد الميزانية تلقائياً
                    b.budget += 15000;
                    balanceSAR += 1200; // عائد استثماري للاعب
                }

                // توزيع منتجات المتجر ترفع رضا الموظفين وتزيد الجودة 500 نقطة
                if (storeStock > 0) {
                    b.quality += 500;
                    b.budget += 8000;
                }
            }
        });

        // 3. دورة المتجر والضرائب والقروض
        taxRate += 0.15; // ترتفع الضريبة تدريجياً مع تبادل المعلومات
        if (taxRate > 5.0) {
            // إذا زادت الضريبة فوق 5% تتناقص المنتجات
            storeStock = Math.max(0, storeStock - 25000);
            if (storeStock === 0) {
                bankLoans += 1;
                storeStock = 100000; // قرض طارئ لإعادة التشغيل
                taxRate = 3.5;
                setSafeText(statusLog, `🚨 نفد مخزون المتجر بسبب الضريبة! أخذ المتجر قرضاً من البنك (${bankLoans}/3)`);
                if (bankLoans > 3) {
                    triggerEndGame(false);
                }
            }
        }

        updateTopUI();
        checkWinCondition();
    }, 1000);

    // =========================================================
    // دورة العمر والتقاعد (كل دقيقة = سنة واحدة من عمر اللاعب)
    // =========================================================
    setInterval(() => {
        if (gameOver || gameWon) return;
        playerAge += 1;
        if (playerAge >= 60 && !isRetired) {
            isRetired = true;
            setSafeText(statusLog, "👴 بلغت عمر 60 سنة! تم تفعيل راتب التقاعد بقيمة 5,000 ر.س دورياً.");
        }
        if (isRetired) {
            balanceSAR += 5000;
        }
        updateTopUI();
    }, 60000);

    // فحص شرط الفوز (وصول رصيد كل شركة إلى 9 مليون)
    function checkWinCondition() {
        const companies = buildings.filter(b => b.type === "company");
        const allReached9M = companies.every(c => c.budget >= 9000000);
        if (allReached9M && !gameWon) {
            triggerEndGame(true);
        }
    }

    function triggerEndGame(won) {
        if (won) {
            gameWon = true;
            setSafeText(endTitle, "🏆 مبروك! حققت النجاح الاقتصادي الكامل");
            setSafeText(endDesc, "تجاوزت ميزانية جميع الشركات 9 مليون ر.س، وتوسع المتجر والشركات بنجاح باهر!");
        } else {
            gameOver = true;
            setSafeText(endTitle, "🔒 أُغلق المتجر والشركات (خسارة)");
            setSafeText(endDesc, "تجاوزت القروض البنكية 3 قروض بسبب ارتفاع الضرائب ونفاد المخزون.");
        }
        endModal.classList.remove("hidden");
    }

    // =========================================================
    // الرسم على لوحة Canvas
    // =========================================================
    function drawConnections() {
        dashOffset -= 0.7;
        ctx.save();
        ctx.setLineDash([9, 7]);
        ctx.lineDashOffset = dashOffset;
        ctx.lineWidth = 2.5;

        const store = buildings.find(b => b.id === "store");
        const rStore = getBuildingRect(store);

        // خطوط متقطعة تربط المتجر بكل الشركات الأربع (توزيع المنتجات وتبادل المعلومات)
        buildings.forEach(b => {
            if (b.type === "company") {
                const rComp = getBuildingRect(b);
                ctx.strokeStyle = taxRate > 5.0 ? "#ef4444" : "#0284c7";
                ctx.beginPath();
                ctx.moveTo(rStore.cx, rStore.cy);
                ctx.lineTo(rComp.cx, rComp.cy);
                ctx.stroke();
            }
        });

        // خط متقطع بين شركة الواردات وشركة التعلم (مسار السيارة)
        const rMarine = getBuildingRect(buildings.find(b => b.id === "marine"));
        const rEdu = getBuildingRect(buildings.find(b => b.id === "edu"));
        ctx.strokeStyle = "#f59e0b";
        ctx.beginPath();
        ctx.moveTo(rMarine.cx, rMarine.cy);
        ctx.lineTo(rEdu.cx, rEdu.cy);
        ctx.stroke();

        ctx.restore();
    }

    function drawBuildings() {
        buildings.forEach((b) => {
            const r = getBuildingRect(b);

            ctx.fillStyle = b.color;
            ctx.strokeStyle = b.border;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.roundRect(r.x, r.y, r.w, r.h, 12);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 12px Tahoma";
            ctx.textAlign = "center";
            ctx.fillText(b.name, r.cx, r.y + 18);

            if (b.type === "company") {
                // عرض الميزانية والشهرة والجودة داخل بطاقة الشركة
                ctx.fillStyle = "#fde047";
                ctx.font = "11px Tahoma";
                ctx.fillText(`ميزانية: ${(b.budget / 1000).toFixed(0)}k | شهرة: ${(b.fame / 1000).toFixed(1)}k`, r.cx, r.y + 34);

                // مكتب المسؤول
                drawDesk(r.cx, r.y + 52, "#facc15");

                // 5 موظفين بمكاتبهم
                const cols = 3;
                for (let i = 0; i < b.employees; i++) {
                    const col = i % cols;
                    const row = Math.floor(i / cols);
                    const wx = r.x + 42 + col * 70;
                    const wy = r.y + 88 + row * 34;
                    drawDesk(wx, wy, "#38bdf8");
                }
            } else if (b.id === "store") {
                ctx.fillStyle = "#fed7aa";
                ctx.font = "11px Tahoma";
                ctx.fillText(`المخزون: ${Math.floor(storeStock).toLocaleString()}`, r.cx, r.y + 42);
                ctx.fillText(`ضريبة المعلومات: ${taxRate.toFixed(1)}%`, r.cx, r.y + 62);
            } else if (b.id === "bank") {
                ctx.fillStyle = "#93c5fd";
                ctx.font = "11px Tahoma";
                ctx.fillText(`قروض المتجر: ${bankLoans} / 3`, r.cx, r.y + 42);
                ctx.fillText("العملة: الريال السعودي (SAR)", r.cx, r.y + 60);
            }
        });
    }

    function drawDesk(x, y, workerColor) {
        ctx.fillStyle = "#d97706";
        ctx.fillRect(x - 14, y - 5, 28, 10);
        ctx.fillStyle = "#e2e8f0";
        ctx.fillRect(x - 5, y - 3, 10, 5);
        ctx.fillStyle = workerColor;
        ctx.beginPath();
        ctx.arc(x, y + 9, 5, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawTruckAndPlayer() {
        // رسم السيارة أثناء نقل الميزانية
        if (truck.active) {
            ctx.font = "22px Tahoma";
            ctx.textAlign = "center";
            ctx.fillText("🚚", truck.x, truck.y);
        }

        // دائرة الهدف
        if (Math.hypot(player.targetX - player.x, player.targetY - player.y) > 5) {
            ctx.strokeStyle = "#ef4444";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(player.targetX, player.targetY, 7, 0, Math.PI * 2);
            ctx.stroke();
        }

        // اللاعب
        ctx.fillStyle = "#ef4444";
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.font = "15px Tahoma";
        ctx.textAlign = "center";
        ctx.fillText("🧑‍💼", player.x, player.y + 5);
    }

    function loop() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawConnections();
        drawBuildings();
        updateEntities();
        checkProximity();
        drawTruckAndPlayer();
        requestAnimationFrame(loop);
    }

    updateTopUI();
    loop();
})();
