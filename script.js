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
    const restartBtn = document.getElementById("restartBtn");

    // حالة اللعبة المعزولة والمحمية ضد التلاعب
    const state = {
        balanceSAR: 15000,
        playerAge: 25,
        playerExp: 1,
        isRetired: false,
        gameOver: false,
        gameWon: false,
        eduContractActive: false,
        eduContractSecondsLeft: 0,
        storeStock: 200000,
        taxRate: 3.0,
        bankLoans: 0,
        lastActionTime: 0
    };

    // التحقق الأمني لمنع النقر السريع الآلي
    function canPerformAction() {
        if (state.gameOver || state.gameWon) return false;
        const now = Date.now();
        if (now - state.lastActionTime < 250) return false;
        state.lastActionTime = now;
        return true;
    }

    // تحديث النصوص بأمان لمنع XSS
    function setSafeText(el, text) {
        if (el) el.textContent = String(text);
    }

    restartBtn.addEventListener("click", () => {
        window.location.reload();
    });

    // قائمة الأسهم النشطة (تظهر فقط عند إرسال معلومات أو منتجات أو قرض)
    const activeArrows = [];

    function spawnArrow(fromId, toId, color, label) {
        activeArrows.push({
            fromId,
            toId,
            color,
            label,
            progress: 0,
            speed: 0.025
        });
    }

    // شاحنة النقل الواقعية بين شركة الواردات وشركة التعلم
    const truck = {
        active: false,
        progress: 0,
        speed: 0.012
    };

    // اللاعب
    const player = {
        x: 0,
        y: 0,
        targetX: 0,
        targetY: 0,
        speed: 5,
        radius: 13,
        initialized: false
    };

    // المباني
    const buildings = [
        {
            id: "bank",
            name: "🏦 البنك المركزي",
            type: "bank",
            rx: 0.50, ry: 0.15,
            w: 165, h: 75,
            color: "#1e3a8a", border: "#3b82f6"
        },
        {
            id: "store",
            name: "🏪 المتجر الموزع",
            type: "store",
            rx: 0.50, ry: 0.85,
            w: 185, h: 80,
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

    function updateTopUI() {
        setSafeText(balanceDisplay, Math.floor(state.balanceSAR).toLocaleString("en-US"));
        setSafeText(ageDisplay, state.playerAge);
        setSafeText(expDisplay, state.playerExp);
        setSafeText(stockDisplay, Math.floor(state.storeStock).toLocaleString("en-US"));
        setSafeText(taxDisplay, state.taxRate.toFixed(1));
        setSafeText(loansDisplay, state.bankLoans);
    }

    function resizeCanvas() {
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        if (!player.initialized) {
            player.x = canvas.width * 0.5;
            player.y = canvas.height * 0.5;
            player.targetX = player.x;
            player.targetY = player.y;
            player.initialized = true;
        }
    }
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    function getBuildingRect(b) {
        const scale = state.gameWon ? 1.12 : 1.0;
        const w = b.w * scale;
        const h = b.h * scale;
        const cx = b.rx * canvas.width;
        const cy = b.ry * canvas.height;
        return { cx, cy, x: cx - w / 2, y: cy - h / 2, w, h };
    }

    // التحرك بالماوس أو اللمس
    function handlePointerMove(clientX, clientY) {
        if (state.gameOver || state.gameWon) return;
        const rect = canvas.getBoundingClientRect();
        player.targetX = Math.max(20, Math.min(canvas.width - 20, clientX - rect.left));
        player.targetY = Math.max(20, Math.min(canvas.height - 20, clientY - rect.top));
    }

    canvas.addEventListener("mousedown", (e) => handlePointerMove(e.clientX, e.clientY));
    canvas.addEventListener("touchstart", (e) => {
        if (e.touches.length > 0) {
            handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
        }
    }, { passive: true });

    // تحديث حركة اللاعب والسيارة والأسهم
    function updateSimulation() {
        // 1. حركة اللاعب
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

        // 2. حركة شاحنة التمويل (من شركة الواردات إلى شركة التعلم)
        if (truck.active) {
            truck.progress += truck.speed;
            if (truck.progress >= 1) {
                truck.active = false;
                truck.progress = 0;
                const eduComp = buildings.find(b => b.id === "edu");
                eduComp.budget += 15000;
                state.balanceSAR += 3000;
                updateTopUI();
                setSafeText(statusLog, "🚚 وصلت الشاحنة إلى شركة التعلم! تم دعم ميزانيتها بـ +15,000 ر.س ومكافأتك بـ +3,000 ر.س.");
                if (currentBuildingId === "edu" || currentBuildingId === "marine") {
                    renderActionPanel(buildings.find(b => b.id === currentBuildingId));
                }
            }
        }

        // 3. تحديث حركة الأسهم النشطة (تختفي فور وصولها للمستقبل)
        for (let i = activeArrows.length - 1; i >= 0; i--) {
            activeArrows[i].progress += activeArrows[i].speed;
            if (activeArrows[i].progress >= 1) {
                activeArrows.splice(i, 1);
            }
        }
    }

    let currentBuildingId = null;
    function checkProximity() {
        let found = null;
        for (const b of buildings) {
            const r = getBuildingRect(b);
            if (player.x >= r.x - 15 && player.x <= r.x + r.w + 15 &&
                player.y >= r.y - 15 && player.y <= r.y + r.h + 15) {
                found = b;
                break;
            }
        }

        if (found && found.id !== currentBuildingId) {
            currentBuildingId = found.id;
            renderActionPanel(found);
        } else if (!found && currentBuildingId !== null) {
            currentBuildingId = null;
            setSafeText(locationTitle, "المس أو انقر على أي مبنى في الخريطة للتحرك إليه 🚶‍♂️");
            locationButtons.innerHTML = "";
        }
    }

    function renderActionPanel(b) {
        locationButtons.innerHTML = "";

        if (b.id === "edu") {
            setSafeText(locationTitle, `🎓 ${b.name} | الميزانية: ${b.budget.toLocaleString()} ر.س | الشهرة: ${b.fame.toLocaleString()} | الجودة: ${b.quality.toLocaleString()}`);

            const applyBtn = document.createElement("button");
            applyBtn.className = "success-btn";
            if (state.eduContractActive) {
                setSafeText(applyBtn, `عقدك نشط (${state.eduContractSecondsLeft} ثانية متبقية)`);
                applyBtn.disabled = true;
            } else {
                setSafeText(applyBtn, "توظيف سنتين (دقيقتين) براتب 7,500 ر.س (رسوم 2,000)");
                applyBtn.onclick = () => {
                    if (!canPerformAction()) return;
                    if (state.playerExp < 1) {
                        setSafeText(statusLog, "⚠️ يشترط وجود خبرة سنة على الأقل!");
                        return;
                    }
                    if (state.balanceSAR < 2000) {
                        setSafeText(statusLog, "⚠️ رصيدك أقل من 2,000 ر.س لدفع رسوم التوظيف!");
                        return;
                    }
                    state.balanceSAR -= 2000;
                    b.budget += 2000;
                    state.eduContractActive = true;
                    state.eduContractSecondsLeft = 120;
                    updateTopUI();
                    renderActionPanel(b);
                    setSafeText(statusLog, "🎓 تم توقيع عقدك في شركة التعلم لمدة سنتين (دقيقتين) براتب 7,500 ر.س!");
                };
            }
            locationButtons.appendChild(applyBtn);

            addInvestButton(b);

        } else if (b.id === "marine") {
            setSafeText(locationTitle, `🚢 ${b.name} | الميزانية: ${b.budget.toLocaleString()} ر.س | الشهرة: ${b.fame.toLocaleString()}`);

            const driveBtn = document.createElement("button");
            driveBtn.className = "warn-btn";
            setSafeText(driveBtn, truck.active ? "الشاحنة في الطريق حالياً 🚚..." : "قيادة شاحنة التمويل إلى شركة التعلم 🚚");
            driveBtn.disabled = truck.active;
            driveBtn.onclick = () => {
                if (!canPerformAction() || truck.active) return;
                truck.active = true;
                truck.progress = 0;
                renderActionPanel(b);
                setSafeText(statusLog, "🚚 انطلقت الشاحنة محملة بالميزانية من شركة الواردات نحو شركة التعلم!");
            };
            locationButtons.appendChild(driveBtn);

            addInvestButton(b);

        } else if (b.type === "company") {
            setSafeText(locationTitle, `🏢 ${b.name} | الميزانية: ${b.budget.toLocaleString()} ر.س | الشهرة: ${b.fame.toLocaleString()} | الجودة: ${b.quality.toLocaleString()}`);
            addInvestButton(b);

        } else if (b.id === "store") {
            setSafeText(locationTitle, `🏪 المتجر الموزع | المخزون: ${Math.floor(state.storeStock).toLocaleString()} منتج | الضريبة: ${state.taxRate.toFixed(1)}%`);

            const restockBtn = document.createElement("button");
            restockBtn.className = "success-btn";
            setSafeText(restockBtn, "توريد +200,000 منتج وخفض الضريبة (-3,000 ر.س)");
            restockBtn.onclick = () => {
                if (!canPerformAction()) return;
                if (state.balanceSAR < 3000) {
                    setSafeText(statusLog, "⚠️ تحتاج 3,000 ر.س لتوريد البضائع للمتجر.");
                    return;
                }
                state.balanceSAR -= 3000;
                state.storeStock += 200000;
                state.taxRate = Math.max(2.0, state.taxRate - 2.0);
                updateTopUI();
                renderActionPanel(b);
                setSafeText(statusLog, "📦 تم تجديد مخزون المتجر (+200,000 منتج) وتخفيض الضريبة!");
            };
            locationButtons.appendChild(restockBtn);

        } else if (b.id === "bank") {
            setSafeText(locationTitle, `🏦 البنك المركزي | قروض المتجر المسجلة: ${state.bankLoans} من 3`);

            const payLoanBtn = document.createElement("button");
            payLoanBtn.className = "warn-btn";
            setSafeText(payLoanBtn, "سداد قرض عن المتجر (-8,000 ر.س)");
            payLoanBtn.disabled = state.bankLoans === 0;
            payLoanBtn.onclick = () => {
                if (!canPerformAction()) return;
                if (state.bankLoans > 0 && state.balanceSAR >= 8000) {
                    state.balanceSAR -= 8000;
                    state.bankLoans -= 1;
                    updateTopUI();
                    renderActionPanel(b);
                    setSafeText(statusLog, "✅ تم سداد قرض بنجاح وتقليص مديونية المتجر!");
                } else {
                    setSafeText(statusLog, "⚠️ تحتاج 8,000 ر.س لسداد القرض.");
                }
            };
            locationButtons.appendChild(payLoanBtn);
        }
    }

    function addInvestButton(company) {
        const investBtn = document.createElement("button");
        setSafeText(investBtn, "ضخ استثمار توسعي (+1,500,000 ر.س)");
        investBtn.onclick = () => {
            if (!canPerformAction()) return;
            if (state.balanceSAR < 4000) {
                setSafeText(statusLog, "⚠️ تحتاج 4,000 ر.س من رصيدك الشخصي لتمويل التوسع.");
                return;
            }
            state.balanceSAR -= 4000;
            company.budget += 1500000;
            updateTopUI();
            renderActionPanel(company);
            setSafeText(statusLog, `📈 تم ضخ استثمار ضخم في ${company.name}!`);
            checkWinCondition();
        };
        locationButtons.appendChild(investBtn);
    }

    // =========================================================
    // محاكاة الاقتصاد والأسهم التفاعلية (كل 2.5 ثانية)
    // =========================================================
    let cycleCount = 0;
    setInterval(() => {
        if (state.gameOver || state.gameWon) return;
        cycleCount++;

        const companies = buildings.filter(b => b.type === "company");
        const targetCompany = companies[cycleCount % companies.length];

        // 1. إرسال منتجات من المتجر إلى إحدى الشركات (سهم أخضر)
        if (state.storeStock > 0) {
            spawnArrow("store", targetCompany.id, "#10b981", "📦 منتجات");
            targetCompany.quality += 500; // المنتجات ترفع رضا الموظفين والجودة 500 نقطة
            targetCompany.budget += 12000;
        }

        // 2. إرسال معلومات من الشركة إلى المتجر مقابل ضريبة (سهم أزرق)
        if (targetCompany.budget > 30000) {
            targetCompany.fame += 500; // الموظفون ينتجون معلومات ترفع الشهرة 500 نقطة
            spawnArrow(targetCompany.id, "store", "#0284c7", "📊 معلومات");
            state.taxRate += 0.35; // ترتفع الضريبة نتيجة تبادل المعلومات
        }

        if (targetCompany.fame > 30000) {
            targetCompany.budget += 25000;
            state.balanceSAR += 1500; // عائد أرباح للاعب
        }

        // 3. منطق الضرائب والقروض البنكية الواقعي
        if (state.taxRate > 5.0) {
            // تجاوزت الضريبة 5% -> يتناقص المخزون تدريجياً حتى يصل للصفر
            state.storeStock = Math.max(0, state.storeStock - 50000);
            setSafeText(statusLog, `⚠️ الضريبة (${state.taxRate.toFixed(1)}%) تجاوزت 5%! يتناقص مخزون المتجر بسرعة.`);

            if (state.storeStock === 0) {
                state.bankLoans += 1;
                spawnArrow("bank", "store", "#ef4444", "🏦 قرض طارئ");
                updateTopUI();

                if (state.bankLoans > 3) {
                    triggerEndGame(false);
                    return;
                } else {
                    // إعادة تزويد جزئي بالقرض البنكي
                    state.storeStock = 100000;
                    state.taxRate = 3.5;
                    setSafeText(statusLog, `🚨 نفد المخزون! أخذ المتجر قرضاً من البنك (${state.bankLoans} من 3). سدد القرض أو ورد بضائع!`);
                }
            }
        }

        if (currentBuildingId) {
            renderActionPanel(buildings.find(b => b.id === currentBuildingId));
        }
        updateTopUI();
        checkWinCondition();
    }, 2500);

    // =========================================================
    // عداد العقود والعمر والتقاعد (كل 1 ثانية)
    // =========================================================
    setInterval(() => {
        if (state.gameOver || state.gameWon) return;

        if (state.eduContractActive) {
            state.eduContractSecondsLeft -= 1;
            if (state.eduContractSecondsLeft % 15 === 0) {
                state.balanceSAR += 7500;
                setSafeText(statusLog, "💵 تم إيداع راتبك من شركة التعلم: +7,500 ر.س!");
            }
            if (state.eduContractSecondsLeft <= 0) {
                state.eduContractActive = false;
                state.playerExp += 5;
                setSafeText(statusLog, "🎉 أتممت عقد السنتين في شركة التعلم! زادت خبرتك +5 سنوات.");
            }
            if (currentBuildingId === "edu") {
                renderActionPanel(buildings.find(b => b.id === "edu"));
            }
            updateTopUI();
        }
    }, 1000);

    // كل دقيقة = سنة من عمر اللاعب
    setInterval(() => {
        if (state.gameOver || state.gameWon) return;
        state.playerAge += 1;
        if (state.playerAge >= 60 && !state.isRetired) {
            state.isRetired = true;
            setSafeText(statusLog, "👴 بلغت 60 سنة! تم تفعيل معاش التقاعد (5,000 ر.س دورياً).");
        }
        if (state.isRetired) {
            state.balanceSAR += 5000;
        }
        updateTopUI();
    }, 60000);

    function checkWinCondition() {
        const companies = buildings.filter(b => b.type === "company");
        if (companies.every(c => c.budget >= 9000000) && !state.gameWon) {
            triggerEndGame(true);
        }
    }

    function triggerEndGame(won) {
        if (won) {
            state.gameWon = true;
            setSafeText(endTitle, "🏆 فوز مستحق! توسعت الإمبراطورية الاقتصادية");
            setSafeText(endDesc, "تجاوزت ميزانية جميع الشركات 9 مليون ر.س، وكبر المتجر والشركات بنجاح!");
        } else {
            state.gameOver = true;
            setSafeText(endTitle, "🔒 إفلاس وإغلاق المتجر والشركات");
            setSafeText(endDesc, "تجاوزت قروض المتجر من البنك 3 قروض بسبب ارتفاع الضرائب فوق 5% ونفاد المخزون.");
        }
        endModal.classList.remove("hidden");
    }

    // =========================================================
    // رسم السهم المتحرك من المرسل للمستقبل
    // =========================================================
    function drawArrows() {
        activeArrows.forEach((arrow) => {
            const bFrom = buildings.find(b => b.id === arrow.fromId);
            const bTo = buildings.find(b => b.id === arrow.toId);
            if (!bFrom || !bTo) return;

            const rFrom = getBuildingRect(bFrom);
            const rTo = getBuildingRect(bTo);

            const curX = rFrom.cx + (rTo.cx - rFrom.cx) * arrow.progress;
            const curY = rFrom.cy + (rTo.cy - rFrom.cy) * arrow.progress;
            const angle = Math.atan2(rTo.cy - rFrom.cy, rTo.cx - rFrom.cx);

            ctx.save();
            // خط مسار السهم الواصل من المرسل إلى النقطة الحالية
            ctx.strokeStyle = arrow.color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(rFrom.cx, rFrom.cy);
            ctx.lineTo(curX, curY);
            ctx.stroke();

            // رأس السهم المثلث
            ctx.translate(curX, curY);
            ctx.rotate(angle);
            ctx.fillStyle = arrow.color;
            ctx.beginPath();
            ctx.moveTo(10, 0);
            ctx.lineTo(-8, -6);
            ctx.lineTo(-8, 6);
            ctx.closePath();
            ctx.fill();
            ctx.restore();

            // نص توضيحي صغير فوق السهم
            ctx.fillStyle = "#0f172a";
            ctx.font = "bold 11px Tahoma";
            ctx.textAlign = "center";
            ctx.fillText(arrow.label, curX, curY - 12);
        });
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
                ctx.fillText(`المخزون: ${Math.floor(state.storeStock).toLocaleString()}`, r.cx, r.y + 42);
                ctx.fillText(`الضريبة: ${state.taxRate.toFixed(1)}%`, r.cx, r.y + 62);
            } else if (b.id === "bank") {
                ctx.fillStyle = "#93c5fd";
                ctx.font = "11px Tahoma";
                ctx.fillText(`قروض المتجر: ${state.bankLoans} / 3`, r.cx, r.y + 42);
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
        // رسم الشاحنة أثناء تحركها من شركة الواردات إلى شركة التعلم
        if (truck.active) {
            const rMarine = getBuildingRect(buildings.find(b => b.id === "marine"));
            const rEdu = getBuildingRect(buildings.find(b => b.id === "edu"));
            const tx = rMarine.cx + (rEdu.cx - rMarine.cx) * truck.progress;
            const ty = rMarine.cy + (rEdu.cy - rMarine.cy) * truck.progress;

            ctx.font = "26px Tahoma";
            ctx.textAlign = "center";
            ctx.fillText("🚚", tx, ty);
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
        drawBuildings();
        drawArrows();
        updateSimulation();
        checkProximity();
        drawTruckAndPlayer();
        requestAnimationFrame(loop);
    }

    updateTopUI();
    loop();
})();
