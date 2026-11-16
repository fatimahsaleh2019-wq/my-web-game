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

    // حالة اللعبة المعزولة والمحمية
    const state = {
        balanceSAR: 15000,
        playerAge: 25,
        playerExp: 1,
        isRetired: false,
        gameOver: false,
        gameWon: false,
        storeStock: 200000,
        taxRate: 3.0,
        bankLoans: 0,
        lastActionTime: 0,
        eduTimer: 0,
        mgmtTimer: 0,
        pubTimer: 0
    };

    function canPerformAction() {
        if (state.gameOver || state.gameWon) return false;
        const now = Date.now();
        if (now - state.lastActionTime < 250) return false;
        state.lastActionTime = now;
        return true;
    }

    function setSafeText(el, text) {
        if (el) el.textContent = String(text);
    }

    restartBtn.addEventListener("click", () => {
        window.location.reload();
    });

    // أسهم التواصل اللحظية (تظهر فقط عند الإرسال الفعلي)
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

    // شاحنة التمويل بين شركة الواردات وشركة التعلم
    const truck = {
        active: false,
        progress: 0,
        speed: 0.014
    };

    // الطائرة وحركتها الواقعية على المدرج وفي الجو (15 ثانية)
    const plane = {
        active: false,
        secondsLeft: 0,
        totalSeconds: 15,
        cargoType: "",
        animProgress: 0 // حركة سلسة 60 إطار بالثانية
    };

    // السفن وحركتها البحرية الملاصقة لشركة الواردات (12 ثانية)
    const ship = {
        active: false,
        secondsLeft: 0,
        totalSeconds: 12,
        waveOffset: 0,
        animProgress: 0
    };

    // اللاعب
    const player = {
        x: 0,
        y: 0,
        targetX: 0,
        targetY: 0,
        speed: 5.5,
        radius: 13,
        initialized: false
    };

    // المباني والمرافق (البنك، المتجر، المطار بالوسط، والشركات الأربع)
    const buildings = [
        {
            id: "bank",
            name: "🏦 البنك المركزي",
            type: "bank",
            rx: 0.54, ry: 0.13,
            w: 165, h: 68,
            color: "#1e3a8a", border: "#3b82f6"
        },
        {
            id: "airport",
            name: "✈️ المطار الدولي",
            type: "airport",
            rx: 0.54, ry: 0.50,
            w: 220, h: 90,
            color: "#1e293b", border: "#38bdf8"
        },
        {
            id: "store",
            name: "🏪 المتجر الموزع",
            type: "store",
            rx: 0.54, ry: 0.87,
            w: 180, h: 72,
            color: "#7c2d12", border: "#f97316"
        },
        {
            id: "edu",
            name: "شركة التعلم",
            type: "company",
            rx: 0.27, ry: 0.22,
            w: 210, h: 138,
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
            rx: 0.84, ry: 0.22,
            w: 210, h: 138,
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
            rx: 0.26, ry: 0.78, // ملاصقة مباشرة للشاطئ والبحر
            w: 210, h: 138,
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
            rx: 0.84, ry: 0.78,
            w: 210, h: 138,
            color: "#4c1d95", border: "#a855f7",
            budget: 32000,
            fame: 14000,
            quality: 1500,
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
            player.x = canvas.width * 0.54;
            player.y = canvas.height * 0.32;
            player.targetX = player.x;
            player.targetY = player.y;
            player.initialized = true;
        }
    }
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    function getBuildingRect(b) {
        const scale = state.gameWon ? 1.08 : 1.0;
        const w = b.w * scale;
        const h = b.h * scale;
        const cx = b.rx * canvas.width;
        const cy = b.ry * canvas.height;
        return { cx, cy, x: cx - w / 2, y: cy - h / 2, w, h };
    }

    function handlePointerMove(clientX, clientY) {
        if (state.gameOver || state.gameWon) return;
        const rect = canvas.getBoundingClientRect();
        const minX = canvas.width * 0.15; // حدود الشاطئ
        player.targetX = Math.max(minX, Math.min(canvas.width - 20, clientX - rect.left));
        player.targetY = Math.max(20, Math.min(canvas.height - 20, clientY - rect.top));
    }

    canvas.addEventListener("mousedown", (e) => handlePointerMove(e.clientX, e.clientY));
    canvas.addEventListener("touchstart", (e) => {
        if (e.touches.length > 0) {
            handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
        }
    }, { passive: true });

    function updateSimulation() {
        // حركة اللاعب
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

        // حركة الشاحنة
        if (truck.active) {
            truck.progress += truck.speed;
            if (truck.progress >= 1) {
                truck.active = false;
                truck.progress = 0;
                const eduComp = buildings.find(b => b.id === "edu");
                eduComp.budget += 15000;
                state.balanceSAR += 3000;
                updateTopUI();
                setSafeText(statusLog, "🚚 وصلت الشاحنة لشركة التعلم! +15,000 ر.س لميزانيتها و +3,000 ر.س مكافأة لك.");
                refreshCurrentPanel();
            }
        }

        // حركة الطائرة السلسة (60 إطار في الثانية)
        if (plane.active) {
            plane.animProgress = Math.min(1, plane.animProgress + (1 / (plane.totalSeconds * 60)));
        } else {
            plane.animProgress = 0;
        }

        // حركة السفينة السلسة في البحر
        if (ship.active) {
            ship.animProgress = Math.min(1, ship.animProgress + (1 / (ship.totalSeconds * 60)));
        } else {
            ship.animProgress = 0;
        }

        // تحديث الأسهم اللحظية
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
            if (player.x >= r.x - 16 && player.x <= r.x + r.w + 16 &&
                player.y >= r.y - 16 && player.y <= r.y + r.h + 16) {
                found = b;
                break;
            }
        }

        if (found && found.id !== currentBuildingId) {
            currentBuildingId = found.id;
            renderActionPanel(found);
        } else if (!found && currentBuildingId !== null) {
            currentBuildingId = null;
            setSafeText(locationTitle, "المس أو انقر على المطار بالوسط أو الميناء البحري أو الشركات للتحرك 🚶‍♂️");
            locationButtons.innerHTML = "";
        }
    }

    function refreshCurrentPanel() {
        if (currentBuildingId) {
            const b = buildings.find(x => x.id === currentBuildingId);
            if (b) renderActionPanel(b);
        }
    }

    function renderActionPanel(b) {
        locationButtons.innerHTML = "";

        if (b.id === "airport") {
            setSafeText(locationTitle, "✈️ المطار الدولي | الشروط: خبرة 3 سنوات + رسوم 4,000 ر.س + ضريبة < 5.5% (الرحلة: 15ث)");
            
            const importProductsBtn = document.createElement("button");
            importProductsBtn.className = "success-btn";
            setSafeText(importProductsBtn, plane.active ? `✈️ الطائرة في رحلة (${plane.secondsLeft}ث)` : "استيراد منتجات دولية (+150,000 منتج)");
            importProductsBtn.disabled = plane.active;
            importProductsBtn.onclick = () => startFlight("products");
            locationButtons.appendChild(importProductsBtn);

            const importStaffBtn = document.createElement("button");
            importStaffBtn.className = "warn-btn";
            setSafeText(importStaffBtn, plane.active ? `✈️ الطائرة في رحلة (${plane.secondsLeft}ث)` : "نقل موظفين دوليين (+1 موظف لكل شركة)");
            importStaffBtn.disabled = plane.active;
            importStaffBtn.onclick = () => startFlight("staff");
            locationButtons.appendChild(importStaffBtn);

        } else if (b.id === "edu") {
            setSafeText(locationTitle, `🎓 ${b.name} | ميزانية: ${b.budget.toLocaleString()} | شهرة: ${b.fame.toLocaleString()} | جودة: ${b.quality.toLocaleString()}`);
            
            const applyBtn = document.createElement("button");
            applyBtn.className = "success-btn";
            if (state.eduTimer > 0) {
                setSafeText(applyBtn, `عقد التوظيف سارٍ (${state.eduTimer}ث)`);
                applyBtn.disabled = true;
            } else {
                setSafeText(applyBtn, "توظيف سنتين (120ث) براتب 7,500 ر.س (رسوم 2,000)");
                applyBtn.onclick = () => {
                    if (!canPerformAction()) return;
                    if (state.playerExp < 1) {
                        setSafeText(statusLog, "⚠️ يشترط خبرة سنة على الأقل!");
                        return;
                    }
                    if (state.balanceSAR < 2000) {
                        setSafeText(statusLog, "⚠️ تحتاج 2,000 ر.س لدفع رسوم التوظيف!");
                        return;
                    }
                    state.balanceSAR -= 2000;
                    b.budget += 2000;
                    state.eduTimer = 120;
                    updateTopUI();
                    refreshCurrentPanel();
                    setSafeText(statusLog, "🎓 تم توظيفك في شركة التعلم لمدة سنتين (120 ثانية)!");
                };
            }
            locationButtons.appendChild(applyBtn);
            addInvestButton(b);

        } else if (b.id === "marine") {
            setSafeText(locationTitle, `🚢 ${b.name} والميناء البحري | ميزانية: ${b.budget.toLocaleString()} | شهرة: ${b.fame.toLocaleString()}`);

            const shipBtn = document.createElement("button");
            shipBtn.className = "success-btn";
            setSafeText(shipBtn, ship.active ? `🚢 السفينة تبحر (${ship.secondsLeft}ث)` : "إبحار سفينة شحن (12ث) (+25k ميزانية و +100k منتج)");
            shipBtn.disabled = ship.active;
            shipBtn.onclick = () => {
                if (!canPerformAction() || ship.active) return;
                if (state.balanceSAR < 2500) {
                    setSafeText(statusLog, "⚠️ تحتاج 2,500 ر.س لتشغيل السفينة البحرية!");
                    return;
                }
                state.balanceSAR -= 2500;
                ship.active = true;
                ship.secondsLeft = ship.totalSeconds;
                ship.animProgress = 0;
                updateTopUI();
                refreshCurrentPanel();
                setSafeText(statusLog, "🚢 أبحرت السفينة من الميناء لجلب الإمدادات البحرية (12 ثانية)!");
            };
            locationButtons.appendChild(shipBtn);

            const driveBtn = document.createElement("button");
            driveBtn.className = "warn-btn";
            setSafeText(driveBtn, truck.active ? "الشاحنة في الطريق 🚚..." : "شاحنة تمويل لشركة التعلم 🚚");
            driveBtn.disabled = truck.active;
            driveBtn.onclick = () => {
                if (!canPerformAction() || truck.active) return;
                truck.active = true;
                truck.progress = 0;
                refreshCurrentPanel();
                setSafeText(statusLog, "🚚 انطلقت شاحنة التمويل نحو شركة التعلم!");
            };
            locationButtons.appendChild(driveBtn);
            addInvestButton(b);

        } else if (b.id === "mgmt") {
            setSafeText(locationTitle, `📊 ${b.name} | ميزانية: ${b.budget.toLocaleString()} | شهرة: ${b.fame.toLocaleString()}`);
            
            const restrucBtn = document.createElement("button");
            restrucBtn.className = "warn-btn";
            if (state.mgmtTimer > 0) {
                setSafeText(restrucBtn, `إعادة الهيكلة جارية (${state.mgmtTimer}ث)`);
                restrucBtn.disabled = true;
            } else {
                setSafeText(restrucBtn, "تحدي الهيكلة الإدارية (25ث) - شرط ميزانية 30k");
                restrucBtn.onclick = () => {
                    if (!canPerformAction()) return;
                    if (b.budget < 30000) {
                        setSafeText(statusLog, "⚠️ يشترط وجود ميزانية 30,000 ر.س في شركة الإدارة!");
                        return;
                    }
                    state.mgmtTimer = 25;
                    refreshCurrentPanel();
                    setSafeText(statusLog, "📊 بدأ مشروع إعادة الهيكلة الإدارية (25 ثانية) لخفض الضرائب!");
                };
            }
            locationButtons.appendChild(restrucBtn);
            addInvestButton(b);

        } else if (b.id === "saudi_pub") {
            setSafeText(locationTitle, `📚 ${b.name} | ميزانية: ${b.budget.toLocaleString()} | جودة: ${b.quality.toLocaleString()}`);
            
            const pubBtn = document.createElement("button");
            pubBtn.className = "warn-btn";
            if (state.pubTimer > 0) {
                setSafeText(pubBtn, `حملة النشر جارية (${state.pubTimer}ث)`);
                pubBtn.disabled = true;
            } else {
                setSafeText(pubBtn, "تحدي النشر الوطني (20ث) - شرط جودة 1,500");
                pubBtn.onclick = () => {
                    if (!canPerformAction()) return;
                    if (b.quality < 1500) {
                        setSafeText(statusLog, "⚠️ يشترط وصول جودة الشركة إلى 1,500 نقطة!");
                        return;
                    }
                    state.pubTimer = 20;
                    refreshCurrentPanel();
                    setSafeText(statusLog, "📚 انطلقت حملة الإصدارات السعودية (20 ثانية) لرفع الشهرة والميزانية!");
                };
            }
            locationButtons.appendChild(pubBtn);
            addInvestButton(b);

        } else if (b.id === "store") {
            setSafeText(locationTitle, `🏪 المتجر الموزع | المخزون: ${Math.floor(state.storeStock).toLocaleString()} | الضريبة: ${state.taxRate.toFixed(1)}%`);
            const restockBtn = document.createElement("button");
            restockBtn.className = "success-btn";
            setSafeText(restockBtn, "توريد محلي +200,000 منتج وخفض الضريبة (-3,000 ر.س)");
            restockBtn.onclick = () => {
                if (!canPerformAction()) return;
                if (state.balanceSAR < 3000) {
                    setSafeText(statusLog, "⚠️ تحتاج 3,000 ر.س للتوريد!");
                    return;
                }
                state.balanceSAR -= 3000;
                state.storeStock += 200000;
                state.taxRate = Math.max(2.0, state.taxRate - 2.0);
                updateTopUI();
                refreshCurrentPanel();
                setSafeText(statusLog, "📦 تم تجديد مخزون المتجر (+200,000 منتج) وتخفيض الضريبة!");
            };
            locationButtons.appendChild(restockBtn);

        } else if (b.id === "bank") {
            setSafeText(locationTitle, `🏦 البنك المركزي | قروض المتجر: ${state.bankLoans} من 3`);
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
                    refreshCurrentPanel();
                    setSafeText(statusLog, "✅ تم سداد قرض بنجاح!");
                } else {
                    setSafeText(statusLog, "⚠️ تحتاج 8,000 ر.س لسداد القرض.");
                }
            };
            locationButtons.appendChild(payLoanBtn);
        }
    }

    function startFlight(type) {
        if (!canPerformAction() || plane.active) return;
        if (state.playerExp < 3) {
            setSafeText(statusLog, "⚠️ شروط المطار: يجب أن تمتلك خبرة 3 سنوات على الأقل لتشغيل الرحلات الدولية!");
            return;
        }
        if (state.taxRate >= 5.5) {
            setSafeText(statusLog, "⚠️ شروط المطار: الرحلات معلقة لأن الضريبة مرتفعة (5.5% أو أكثر)!");
            return;
        }
        if (state.balanceSAR < 4000) {
            setSafeText(statusLog, "⚠️ شروط المطار: تحتاج 4,000 ر.س لدفع رسوم الشحن الجوي!");
            return;
        }
        state.balanceSAR -= 4000;
        plane.active = true;
        plane.secondsLeft = plane.totalSeconds;
        plane.animProgress = 0;
        plane.cargoType = type;
        updateTopUI();
        refreshCurrentPanel();
        setSafeText(statusLog, "✈️ أقلعت الطائرة من المدرج في رحلة دولية (15 ثانية)!");
    }

    function addInvestButton(company) {
        const investBtn = document.createElement("button");
        setSafeText(investBtn, "ضخ استثمار (+1,500,000 ر.س)");
        investBtn.onclick = () => {
            if (!canPerformAction()) return;
            if (state.balanceSAR < 4000) {
                setSafeText(statusLog, "⚠️ تحتاج 4,000 ر.س للاستثمار.");
                return;
            }
            state.balanceSAR -= 4000;
            company.budget += 1500000;
            updateTopUI();
            refreshCurrentPanel();
            setSafeText(statusLog, `📈 تم ضخ استثمار توسعي في ${company.name}!`);
            checkWinCondition();
        };
        locationButtons.appendChild(investBtn);
    }

    // المؤقتات الزمنية (كل 1 ثانية)
    setInterval(() => {
        if (state.gameOver || state.gameWon) return;

        if (plane.active) {
            plane.secondsLeft -= 1;
            if (plane.secondsLeft <= 0) {
                plane.active = false;
                if (plane.cargoType === "products") {
                    state.storeStock += 150000;
                    spawnArrow("airport", "store", "#38bdf8", "✈️ +150k منتج");
                    setSafeText(statusLog, "🛬 هبطت الطائرة بسلام! تم تزويد المتجر بـ +150,000 منتج مستورد.");
                } else {
                    buildings.forEach(b => {
                        if (b.type === "company" && b.employees < 8) {
                            b.employees += 1;
                            spawnArrow("airport", b.id, "#facc15", "👨‍💼 موظف دولي");
                        }
                    });
                    setSafeText(statusLog, "🛬 هبطت الطائرة بسلام! تم توزيع موظفين دوليين على الشركات.");
                }
            }
            refreshCurrentPanel();
            updateTopUI();
        }

        if (ship.active) {
            ship.secondsLeft -= 1;
            if (ship.secondsLeft <= 0) {
                ship.active = false;
                const marineComp = buildings.find(b => b.id === "marine");
                marineComp.budget += 25000;
                state.storeStock += 100000;
                spawnArrow("marine", "store", "#06b6d4", "🚢 إمداد بحري");
                setSafeText(statusLog, "⚓ رست السفينة في الميناء! +25,000 ميزانية للبحرية و +100,000 منتج للمتجر.");
            }
            refreshCurrentPanel();
            updateTopUI();
        }

        if (state.eduTimer > 0) {
            state.eduTimer -= 1;
            if (state.eduTimer % 15 === 0) {
                state.balanceSAR += 7500;
                setSafeText(statusLog, "💵 تم إيداع راتبك من شركة التعلم: +7,500 ر.س!");
            }
            if (state.eduTimer === 0) {
                state.playerExp += 5;
                setSafeText(statusLog, "🎉 أتممت عقد السنتين في شركة التعلم! اكتسبت +5 سنوات خبرة.");
            }
            refreshCurrentPanel();
            updateTopUI();
        }

        if (state.mgmtTimer > 0) {
            state.mgmtTimer -= 1;
            if (state.mgmtTimer === 0) {
                state.taxRate = Math.max(1.5, state.taxRate - 1.5);
                state.balanceSAR += 6000;
                setSafeText(statusLog, "✅ اكتملت إعادة الهيكلة الإدارية! انخفضت الضريبة 1.5% وحصلت على +6,000 ر.س.");
            }
            refreshCurrentPanel();
            updateTopUI();
        }

        if (state.pubTimer > 0) {
            state.pubTimer -= 1;
            if (state.pubTimer === 0) {
                const pubComp = buildings.find(b => b.id === "saudi_pub");
                pubComp.fame += 10000;
                pubComp.budget += 40000;
                setSafeText(statusLog, "📚 نجحت حملة الإصدارات السعودية! ارتفعت الشهرة +10,000 والميزانية +40,000 ر.س.");
            }
            refreshCurrentPanel();
        }
    }, 1000);

    // محاكاة الاقتصاد والأسهم اللحظية (كل 2.5 ثانية)
    let cycleCount = 0;
    setInterval(() => {
        if (state.gameOver || state.gameWon) return;
        cycleCount++;

        const companies = buildings.filter(b => b.type === "company");
        const targetCompany = companies[cycleCount % companies.length];

        if (state.storeStock > 0) {
            spawnArrow("store", targetCompany.id, "#10b981", "📦 منتجات");
            targetCompany.quality += 500;
            targetCompany.budget += 12000;
        }

        if (targetCompany.budget > 30000) {
            targetCompany.fame += 500;
            spawnArrow(targetCompany.id, "store", "#0284c7", "📊 معلومات");
            state.taxRate += 0.35;
        }

        if (targetCompany.fame > 30000) {
            targetCompany.budget += 25000;
            state.balanceSAR += 1500;
        }

        if (state.taxRate > 5.0) {
            state.storeStock = Math.max(0, state.storeStock - 50000);
            if (state.storeStock === 0) {
                state.bankLoans += 1;
                spawnArrow("bank", "store", "#ef4444", "🏦 قرض");
                updateTopUI();

                if (state.bankLoans > 3) {
                    triggerEndGame(false);
                    return;
                } else {
                    state.storeStock = 100000;
                    state.taxRate = 3.5;
                    setSafeText(statusLog, `🚨 نفد المخزون بسبب الضريبة! أخذ المتجر قرضاً من البنك (${state.bankLoans}/3).`);
                }
            }
        }

        refreshCurrentPanel();
        updateTopUI();
        checkWinCondition();
    }, 2500);

    // كل دقيقة = سنة من عمر اللاعب
    setInterval(() => {
        if (state.gameOver || state.gameWon) return;
        state.playerAge += 1;
        if (state.playerAge >= 60 && !state.isRetired) {
            state.isRetired = true;
            setSafeText(statusLog, "👴 بلغت عمر 60 سنة! تم تفعيل راتب التقاعد (5,000 ر.س دورياً).");
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
            setSafeText(endDesc, "تجاوزت قروض المتجر 3 قروض بسبب ارتفاع الضرائب فوق 5% ونفاد المخزون.");
        }
        endModal.classList.remove("hidden");
    }

    // =========================================================
    // رسم البحر والسفن الملاصقة لشركة البحرية
    // =========================================================
    function drawSeaAndShips() {
        const seaWidth = canvas.width * 0.14;
        const grad = ctx.createLinearGradient(0, 0, seaWidth, 0);
        grad.addColorStop(0, "#0c4a6e");
        grad.addColorStop(0.7, "#0284c7");
        grad.addColorStop(1, "#38bdf8");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, seaWidth, canvas.height);

        // خط الشاطئ الرملي
        ctx.fillStyle = "#fde047";
        ctx.fillRect(seaWidth - 7, 0, 7, canvas.height);

        // رصيف الميناء الخشبي الممتد نحو البحر بجانب شركة الواردات البحرية
        const marineB = buildings.find(b => b.id === "marine");
        const rMarine = getBuildingRect(marineB);
        ctx.fillStyle = "#92400e";
        ctx.fillRect(seaWidth - 35, rMarine.cy - 12, 42, 24);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 10px Tahoma";
        ctx.textAlign = "center";
        ctx.fillText("⚓ ميناء", seaWidth - 15, rMarine.cy + 4);

        // أمواج البحر المتحركة
        ship.waveOffset += 0.035;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
        ctx.lineWidth = 2;
        for (let y = 25; y < canvas.height; y += 50) {
            const wx = 15 + Math.sin(ship.waveOffset + y * 0.05) * 6;
            ctx.beginPath();
            ctx.moveTo(wx, y);
            ctx.quadraticCurveTo(wx + 18, y - 7, wx + 36, y);
            ctx.stroke();
        }

        // السفن في البحر
        ctx.font = "30px Tahoma";
        ctx.textAlign = "center";

        // سفينة ثابتة تتمايل برفق في الميناء
        const bobbing = Math.sin(ship.waveOffset * 1.5) * 4;
        ctx.fillText("⛵", seaWidth * 0.42, rMarine.cy - 55 + bobbing);

        if (ship.active) {
            // حركة إبحار السفينة ذهاباً وإياباً بوضوح
            const cycle = Math.sin(ship.animProgress * Math.PI); // تذهب للأعلى وتعود للميناء
            const sy = rMarine.cy - cycle * (canvas.height * 0.58);
            ctx.fillText("🚢", seaWidth * 0.55, sy);

            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 11px Tahoma";
            ctx.fillText(`شحن بحري (${ship.secondsLeft}ث)`, seaWidth * 0.55, sy + 20);
        } else {
            // السفينة الرئيسية راسية بجانب رصيف شركة البحرية
            ctx.fillText("🚢", seaWidth * 0.55, rMarine.cy + 10 + bobbing);
        }
    }

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
            ctx.strokeStyle = arrow.color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(rFrom.cx, rFrom.cy);
            ctx.lineTo(curX, curY);
            ctx.stroke();

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
                ctx.font = "10.5px Tahoma";
                ctx.fillText(`ميزانية: ${(b.budget / 1000).toFixed(0)}k | شهرة: ${(b.fame / 1000).toFixed(1)}k`, r.cx, r.y + 33);

                drawDesk(r.cx, r.y + 50, "#facc15");

                const cols = 4;
                for (let i = 0; i < b.employees; i++) {
                    const col = i % cols;
                    const row = Math.floor(i / cols);
                    const wx = r.x + 32 + col * 48;
                    const wy = r.y + 84 + row * 32;
                    drawDesk(wx, wy, "#38bdf8");
                }
            } else if (b.id === "airport") {
                // رسم مدرج المطار بالوسط بوضوح
                const runwayY = r.cy + 14;
                ctx.fillStyle = "#334155";
                ctx.fillRect(r.x + 14, runwayY - 12, r.w - 28, 24);

                // خطوط المدرج البيضاء
                ctx.save();
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 2;
                ctx.setLineDash([10, 8]);
                ctx.beginPath();
                ctx.moveTo(r.x + 22, runwayY);
                ctx.lineTo(r.x + r.w - 22, runwayY);
                ctx.stroke();
                ctx.restore();

                ctx.fillStyle = "#7dd3fc";
                ctx.font = "11px Tahoma";
                if (plane.active) {
                    ctx.fillText(`رحلة دولية جارية (${plane.secondsLeft}ث)`, r.cx, r.y + 34);
                } else {
                    ctx.fillText("مدرج جاهز للإقلاع (خبرة 3+ سنوات)", r.cx, r.y + 34);
                }
            } else if (b.id === "store") {
                ctx.fillStyle = "#fed7aa";
                ctx.font = "11px Tahoma";
                ctx.fillText(`المخزون: ${Math.floor(state.storeStock).toLocaleString()}`, r.cx, r.y + 38);
                ctx.fillText(`الضريبة: ${state.taxRate.toFixed(1)}%`, r.cx, r.y + 56);
            } else if (b.id === "bank") {
                ctx.fillStyle = "#93c5fd";
                ctx.font = "11px Tahoma";
                ctx.fillText(`قروض المتجر: ${state.bankLoans} / 3`, r.cx, r.y + 38);
                ctx.fillText("العملة: الريال السعودي (SAR)", r.cx, r.y + 55);
            }
        });
    }

    function drawDesk(x, y, workerColor) {
        ctx.fillStyle = "#d97706";
        ctx.fillRect(x - 12, y - 4, 24, 9);
        ctx.fillStyle = "#e2e8f0";
        ctx.fillRect(x - 4, y - 2, 8, 4);
        ctx.fillStyle = workerColor;
        ctx.beginPath();
        ctx.arc(x, y + 8, 4.5, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawVehiclesAndPlayer() {
        const rAir = getBuildingRect(buildings.find(b => b.id === "airport"));
        const runwayY = rAir.cy + 14;

        // رسم الطائرة على المدرج أو أثناء الإقلاع والهبوط الواقعي
        ctx.save();
        if (!plane.active) {
            // متوقفة على بداية المدرج جاهزة للإقلاع
            ctx.font = "24px Tahoma";
            ctx.textAlign = "center";
            ctx.fillText("✈️", rAir.x + 35, runwayY + 7);
        } else {
            const p = plane.animProgress;
            let px, py, scale = 1, angle = 0;

            if (p < 0.25) {
                // مرحلة 1: تسارع على المدرج ثم إقلاع للأعلى
                const t = p / 0.25;
                px = rAir.x + 35 + t * (rAir.w - 60);
                py = runwayY - (t > 0.5 ? (t - 0.5) * 140 : 0);
                angle = t > 0.5 ? -0.45 : 0;
                scale = 1 + (t > 0.5 ? (t - 0.5) * 0.6 : 0);
            } else if (p < 0.75) {
                // مرحلة 2: تحليق عالٍ في مسار مستقيم فوق السحاب ثم الالتفاف للعودة
                const t = (p - 0.25) / 0.5;
                px = (rAir.x + rAir.w - 25) - t * (rAir.w - 50);
                py = runwayY - 85 - Math.sin(t * Math.PI) * 35;
                angle = Math.PI; // متجهة لليسار للعودة
                scale = 1.35;
            } else {
                // مرحلة 3: نزول تدريجي وهبوط ناعم على المدرج
                const t = (p - 0.75) / 0.25;
                px = rAir.x + 35 + (1 - t) * 40;
                py = (runwayY - 85) + t * 85;
                angle = 0.35 * (1 - t);
                scale = 1.35 - t * 0.35;
            }

            ctx.translate(px, py);
            ctx.rotate(angle);
            ctx.scale(scale, scale);
            ctx.font = "26px Tahoma";
            ctx.textAlign = "center";
            ctx.fillText("✈️", 0, 8);
        }
        ctx.restore();

        // الشاحنة بين الواردات البحرية والتعلم
        if (truck.active) {
            const rMarine = getBuildingRect(buildings.find(b => b.id === "marine"));
            const rEdu = getBuildingRect(buildings.find(b => b.id === "edu"));
            const tx = rMarine.cx + (rEdu.cx - rMarine.cx) * truck.progress;
            const ty = rMarine.cy + (rEdu.cy - rMarine.cy) * truck.progress;
            ctx.font = "24px Tahoma";
            ctx.textAlign = "center";
            ctx.fillText("🚚", tx, ty);
        }

        // نقطة الهدف
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
        drawSeaAndShips();
        drawBuildings();
        drawArrows();
        updateSimulation();
        checkProximity();
        drawVehiclesAndPlayer();
        requestAnimationFrame(loop);
    }

    updateTopUI();
    loop();
})();
