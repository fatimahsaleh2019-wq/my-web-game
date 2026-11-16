"use strict";

(function () {
    const canvas = document.getElementById("gameCanvas");
    const ctx = canvas.getContext("2d");

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

    restartBtn.addEventListener("click", () => { window.location.reload(); });

    const activeArrows = [];
    function spawnArrow(fromId, toId, color, label) {
        activeArrows.push({ fromId, toId, color, label, progress: 0, speed: 0.025 });
    }

    const truck = { active: false, progress: 0, speed: 0.014 };
    const plane = { active: false, secondsLeft: 0, totalSeconds: 15, cargoType: "", animProgress: 0 };
    const ship = { active: false, secondsLeft: 0, totalSeconds: 12, waveOffset: 0, animProgress: 0 };

    const player = { x: 0, y: 0, targetX: 0, targetY: 0, speed: 5.5, radius: 12, initialized: false };

    // إحداثيات مرنة تتناسب مع أي شاشة
    const buildings = [
        { id: "bank", name: "🏦 البنك المركزي", type: "bank", rx: 0.52, ry: 0.12, w: 150, h: 62, color: "#1e3a8a", border: "#3b82f6" },
        { id: "airport", name: "✈️ المطار الدولي", type: "airport", rx: 0.52, ry: 0.50, w: 190, h: 76, color: "#1e293b", border: "#38bdf8" },
        { id: "store", name: "🏪 المتجر الموزع", type: "store", rx: 0.52, ry: 0.88, w: 165, h: 65, color: "#7c2d12", border: "#f97316" },
        { id: "edu", name: "شركة التعلم", type: "company", rx: 0.25, ry: 0.23, w: 185, h: 125, color: "#064e3b", border: "#10b981", budget: 25000, fame: 10000, quality: 1000, employees: 4 },
        { id: "mgmt", name: "شركة الإدارة", type: "company", rx: 0.79, ry: 0.23, w: 185, h: 125, color: "#312e81", border: "#6366f1", budget: 35000, fame: 15000, quality: 1000, employees: 4 },
        { id: "marine", name: "شركة الواردات البحرية", type: "company", rx: 0.25, ry: 0.77, w: 185, h: 125, color: "#164e63", border: "#06b6d4", budget: 40000, fame: 12000, quality: 1000, employees: 4 },
        { id: "saudi_pub", name: "شركة الإصدارات السعودية", type: "company", rx: 0.79, ry: 0.77, w: 185, h: 125, color: "#4c1d95", border: "#a855f7", budget: 32000, fame: 14000, quality: 1500, employees: 4 }
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
            player.x = canvas.width * 0.52;
            player.y = canvas.height * 0.32;
            player.targetX = player.x;
            player.targetY = player.y;
            player.initialized = true;
        }
    }
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    function getBuildingRect(b) {
        const cx = b.rx * canvas.width;
        const cy = b.ry * canvas.height;
        return { cx, cy, x: cx - b.w / 2, y: cy - b.h / 2, w: b.w, h: b.h };
    }

    function handlePointerMove(clientX, clientY) {
        if (state.gameOver || state.gameWon) return;
        const rect = canvas.getBoundingClientRect();
        const minX = canvas.width * 0.13;
        player.targetX = Math.max(minX, Math.min(canvas.width - 15, clientX - rect.left));
        player.targetY = Math.max(15, Math.min(canvas.height - 15, clientY - rect.top));
    }

    canvas.addEventListener("mousedown", (e) => handlePointerMove(e.clientX, e.clientY));
    canvas.addEventListener("touchstart", (e) => {
        if (e.touches.length > 0) handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });

    function updateSimulation() {
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

        if (truck.active) {
            truck.progress += truck.speed;
            if (truck.progress >= 1) {
                truck.active = false;
                truck.progress = 0;
                buildings.find(b => b.id === "edu").budget += 15000;
                state.balanceSAR += 3000;
                updateTopUI();
                setSafeText(statusLog, "🚚 وصلت الشاحنة لشركة التعلم! +15,000 ر.س ميزانية و +3,000 ر.س مكافأة.");
                refreshCurrentPanel();
            }
        }

        if (plane.active) {
            plane.animProgress = Math.min(1, plane.animProgress + (1 / (plane.totalSeconds * 60)));
        } else {
            plane.animProgress = 0;
        }

        if (ship.active) {
            ship.animProgress = Math.min(1, ship.animProgress + (1 / (ship.totalSeconds * 60)));
        } else {
            ship.animProgress = 0;
        }

        for (let i = activeArrows.length - 1; i >= 0; i--) {
            activeArrows[i].progress += activeArrows[i].speed;
            if (activeArrows[i].progress >= 1) activeArrows.splice(i, 1);
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
            setSafeText(locationTitle, "المس أو انقر على المطار أو الميناء أو الشركات للتحرك 🚶‍♂️");
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
            setSafeText(locationTitle, "✈️ المطار (شروط: خبرة 3+ سنوات، رسوم 4,000 ر.س، ضريبة < 5.5%)");
            
            const pBtn = document.createElement("button");
            pBtn.className = "success-btn";
            setSafeText(pBtn, plane.active ? `✈️ بالطيران (${plane.secondsLeft}ث)` : "استيراد منتجات (+150k)");
            pBtn.disabled = plane.active;
            pBtn.onclick = () => startFlight("products");
            locationButtons.appendChild(pBtn);

            const sBtn = document.createElement("button");
            sBtn.className = "warn-btn";
            setSafeText(sBtn, plane.active ? `✈️ بالطيران (${plane.secondsLeft}ث)` : "موظفون دوليون");
            sBtn.disabled = plane.active;
            sBtn.onclick = () => startFlight("staff");
            locationButtons.appendChild(sBtn);

        } else if (b.id === "edu") {
            setSafeText(locationTitle, `🎓 ${b.name} | ميزانية: ${b.budget.toLocaleString()} | شهرة: ${b.fame.toLocaleString()}`);
            const applyBtn = document.createElement("button");
            applyBtn.className = "success-btn";
            if (state.eduTimer > 0) {
                setSafeText(applyBtn, `عقد نشط (${state.eduTimer}ث)`);
                applyBtn.disabled = true;
            } else {
                setSafeText(applyBtn, "توظيف سنتين (120ث) براتب 7,500 (رسوم 2k)");
                applyBtn.onclick = () => {
                    if (!canPerformAction()) return;
                    if (state.playerExp < 1 || state.balanceSAR < 2000) {
                        setSafeText(statusLog, "⚠️ شروط العقد غير متوفرة (خبرة سنة + 2,000 ر.س)");
                        return;
                    }
                    state.balanceSAR -= 2000;
                    b.budget += 2000;
                    state.eduTimer = 120;
                    updateTopUI();
                    refreshCurrentPanel();
                    setSafeText(statusLog, "🎓 تم توقيع عقد التوظيف بنجاح!");
                };
            }
            locationButtons.appendChild(applyBtn);
            addInvestButton(b);

        } else if (b.id === "marine") {
            setSafeText(locationTitle, `🚢 ${b.name} والميناء | ميزانية: ${b.budget.toLocaleString()}`);
            const shipBtn = document.createElement("button");
            shipBtn.className = "success-btn";
            setSafeText(shipBtn, ship.active ? `🚢 السفينة تبحر (${ship.secondsLeft}ث)` : "إبحار سفينة شحن (12ث)");
            shipBtn.disabled = ship.active;
            shipBtn.onclick = () => {
                if (!canPerformAction() || ship.active || state.balanceSAR < 2500) return;
                state.balanceSAR -= 2500;
                ship.active = true;
                ship.secondsLeft = ship.totalSeconds;
                ship.animProgress = 0;
                updateTopUI();
                refreshCurrentPanel();
                setSafeText(statusLog, "🚢 أبحرت السفينة لجلب الإمدادات البحرية!");
            };
            locationButtons.appendChild(shipBtn);

            const driveBtn = document.createElement("button");
            driveBtn.className = "warn-btn";
            setSafeText(driveBtn, truck.active ? "الشاحنة بالطريق 🚚" : "شاحنة تمويل للتعلم 🚚");
            driveBtn.disabled = truck.active;
            driveBtn.onclick = () => {
                if (!canPerformAction() || truck.active) return;
                truck.active = true;
                truck.progress = 0;
                refreshCurrentPanel();
                setSafeText(statusLog, "🚚 انطلقت شاحنة التمويل!");
            };
            locationButtons.appendChild(driveBtn);
            addInvestButton(b);

        } else if (b.id === "mgmt") {
            setSafeText(locationTitle, `📊 ${b.name} | ميزانية: ${b.budget.toLocaleString()}`);
            const rBtn = document.createElement("button");
            rBtn.className = "warn-btn";
            setSafeText(rBtn, state.mgmtTimer > 0 ? `هيكلة جارية (${state.mgmtTimer}ث)` : "تحدي الهيكلة (25ث)");
            rBtn.disabled = state.mgmtTimer > 0;
            rBtn.onclick = () => {
                if (!canPerformAction() || b.budget < 30000) {
                    setSafeText(statusLog, "⚠️ تتطلب ميزانية 30,000 ر.س على الأقل.");
                    return;
                }
                state.mgmtTimer = 25;
                refreshCurrentPanel();
                setSafeText(statusLog, "📊 بدأت إعادة الهيكلة الإدارية لخفض الضرائب!");
            };
            locationButtons.appendChild(rBtn);
            addInvestButton(b);

        } else if (b.id === "saudi_pub") {
            setSafeText(locationTitle, `📚 ${b.name} | جودة: ${b.quality.toLocaleString()}`);
            const pBtn = document.createElement("button");
            pBtn.className = "warn-btn";
            setSafeText(pBtn, state.pubTimer > 0 ? `حملة جارية (${state.pubTimer}ث)` : "النشر الوطني (20ث)");
            pBtn.disabled = state.pubTimer > 0;
            pBtn.onclick = () => {
                if (!canPerformAction() || b.quality < 1500) {
                    setSafeText(statusLog, "⚠️ تتطلب جودة 1,500 نقطة.");
                    return;
                }
                state.pubTimer = 20;
                refreshCurrentPanel();
                setSafeText(statusLog, "📚 انطلقت حملة النشر لدعم الشهرة والميزانية!");
            };
            locationButtons.appendChild(pBtn);
            addInvestButton(b);

        } else if (b.id === "store") {
            setSafeText(locationTitle, `🏪 المتجر | مخزون: ${Math.floor(state.storeStock).toLocaleString()} | ضريبة: ${state.taxRate.toFixed(1)}%`);
            const restockBtn = document.createElement("button");
            restockBtn.className = "success-btn";
            setSafeText(restockBtn, "توريد +200k (3,000 ر.س)");
            restockBtn.onclick = () => {
                if (!canPerformAction() || state.balanceSAR < 3000) return;
                state.balanceSAR -= 3000;
                state.storeStock += 200000;
                state.taxRate = Math.max(2.0, state.taxRate - 2.0);
                updateTopUI();
                refreshCurrentPanel();
                setSafeText(statusLog, "📦 تم توريد المنتجات وخفض الضريبة بنجاح!");
            };
            locationButtons.appendChild(restockBtn);

        } else if (b.id === "bank") {
            setSafeText(locationTitle, `🏦 البنك المركزي | قروض: ${state.bankLoans}/3`);
            const payBtn = document.createElement("button");
            payBtn.className = "warn-btn";
            setSafeText(payBtn, "سداد قرض (-8,000 ر.س)");
            payBtn.disabled = state.bankLoans === 0;
            payBtn.onclick = () => {
                if (!canPerformAction() || state.bankLoans === 0 || state.balanceSAR < 8000) return;
                state.balanceSAR -= 8000;
                state.bankLoans -= 1;
                updateTopUI();
                refreshCurrentPanel();
                setSafeText(statusLog, "✅ تم سداد القرض بنجاح!");
            };
            locationButtons.appendChild(payBtn);
        }
    }

    function addInvestButton(company) {
        const invBtn = document.createElement("button");
        setSafeText(invBtn, "استثمار (4k)");
        invBtn.onclick = () => {
            if (!canPerformAction() || state.balanceSAR < 4000) {
                setSafeText(statusLog, "⚠️ رصيدك أقل من 4,000 ر.س للاستثمار.");
                return;
            }
            state.balanceSAR -= 4000;
            company.budget += 1500000;
            updateTopUI();
            refreshCurrentPanel();
            setSafeText(statusLog, `📈 تم الاستثمار في ${company.name}!`);
            checkWinCondition();
        };
        locationButtons.appendChild(invBtn);
    }

    function startFlight(type) {
        if (!canPerformAction() || plane.active) return;
        if (state.playerExp < 3 || state.taxRate >= 5.5 || state.balanceSAR < 4000) {
            setSafeText(statusLog, "⚠️ شروط الطيران غير متوفرة (خبرة 3+، ضريبة < 5.5%، رصيد 4,000)");
            return;
        }
        state.balanceSAR -= 4000;
        plane.active = true;
        plane.secondsLeft = plane.totalSeconds;
        plane.animProgress = 0;
        plane.cargoType = type;
        updateTopUI();
        refreshCurrentPanel();
        setSafeText(statusLog, "✈️ أقلعت الطائرة في رحلة دولية (15 ثانية)!");
    }

    setInterval(() => {
        if (state.gameOver || state.gameWon) return;

        if (plane.active) {
            plane.secondsLeft -= 1;
            if (plane.secondsLeft <= 0) {
                plane.active = false;
                if (plane.cargoType === "products") {
                    state.storeStock += 150000;
                    spawnArrow("airport", "store", "#38bdf8", "✈️ +150k منتج");
                    setSafeText(statusLog, "🛬 هبطت الطائرة! تم استيراد 150,000 منتج.");
                } else {
                    buildings.forEach(b => {
                        if (b.type === "company" && b.employees < 8) {
                            b.employees += 1;
                            spawnArrow("airport", b.id, "#facc15", "👨‍💼 موظف");
                        }
                    });
                    setSafeText(statusLog, "🛬 هبطت الطائرة! تم توزيع موظفين دوليين.");
                }
            }
            refreshCurrentPanel();
            updateTopUI();
        }

        if (ship.active) {
            ship.secondsLeft -= 1;
            if (ship.secondsLeft <= 0) {
                ship.active = false;
                buildings.find(b => b.id === "marine").budget += 25000;
                state.storeStock += 100000;
                spawnArrow("marine", "store", "#06b6d4", "🚢 إمداد");
                setSafeText(statusLog, "⚓ وصلت السفينة! +25k ميزانية و +100k منتج.");
            }
            refreshCurrentPanel();
            updateTopUI();
        }

        if (state.eduTimer > 0) {
            state.eduTimer -= 1;
            if (state.eduTimer % 15 === 0) state.balanceSAR += 7500;
            if (state.eduTimer === 0) state.playerExp += 5;
            refreshCurrentPanel();
            updateTopUI();
        }

        if (state.mgmtTimer > 0) {
            state.mgmtTimer -= 1;
            if (state.mgmtTimer === 0) {
                state.taxRate = Math.max(1.5, state.taxRate - 1.5);
                state.balanceSAR += 6000;
            }
            refreshCurrentPanel();
            updateTopUI();
        }

        if (state.pubTimer > 0) {
            state.pubTimer -= 1;
            if (state.pubTimer === 0) {
                const pb = buildings.find(b => b.id === "saudi_pub");
                pb.fame += 10000;
                pb.budget += 40000;
            }
            refreshCurrentPanel();
        }
    }, 1000);

    let cycleCount = 0;
    setInterval(() => {
        if (state.gameOver || state.gameWon) return;
        cycleCount++;
        const companies = buildings.filter(b => b.type === "company");
        const target = companies[cycleCount % companies.length];

        if (state.storeStock > 0) {
            spawnArrow("store", target.id, "#10b981", "📦 منتج");
            target.quality += 500;
            target.budget += 12000;
        }

        if (target.budget > 30000) {
            target.fame += 500;
            spawnArrow(target.id, "store", "#0284c7", "📊 معلومات");
            state.taxRate += 0.35;
        }

        if (target.fame > 30000) {
            target.budget += 25000;
            state.balanceSAR += 1500;
        }

        if (state.taxRate > 5.0) {
            state.storeStock = Math.max(0, state.storeStock - 50000);
            if (state.storeStock === 0) {
                state.bankLoans += 1;
                spawnArrow("bank", "store", "#ef4444", "🏦 قرض");
                if (state.bankLoans > 3) {
                    triggerEndGame(false);
                    return;
                }
                state.storeStock = 100000;
                state.taxRate = 3.5;
            }
        }

        refreshCurrentPanel();
        updateTopUI();
        checkWinCondition();
    }, 2500);

    setInterval(() => {
        if (state.gameOver || state.gameWon) return;
        state.playerAge += 1;
        if (state.playerAge >= 60 && !state.isRetired) state.isRetired = true;
        if (state.isRetired) state.balanceSAR += 5000;
        updateTopUI();
    }, 60000);

    function checkWinCondition() {
        if (buildings.filter(b => b.type === "company").every(c => c.budget >= 9000000) && !state.gameWon) {
            triggerEndGame(true);
        }
    }

    function triggerEndGame(won) {
        if (won) {
            state.gameWon = true;
            setSafeText(endTitle, "🏆 فوز مستحق!");
            setSafeText(endDesc, "تجاوزت ميزانية جميع الشركات 9 مليون ر.س!");
        } else {
            state.gameOver = true;
            setSafeText(endTitle, "🔒 إفلاس وإغلاق");
            setSafeText(endDesc, "تجاوزت قروض المتجر 3 قروض.");
        }
        endModal.classList.remove("hidden");
    }

    function drawSeaAndShips() {
        const seaWidth = canvas.width * 0.13;
        ctx.fillStyle = "#0284c7";
        ctx.fillRect(0, 0, seaWidth, canvas.height);
        ctx.fillStyle = "#fde047";
        ctx.fillRect(seaWidth - 6, 0, 6, canvas.height);

        const rMarine = getBuildingRect(buildings.find(b => b.id === "marine"));
        ctx.fillStyle = "#92400e";
        ctx.fillRect(seaWidth - 30, rMarine.cy - 10, 36, 20);

        ship.waveOffset += 0.035;
        ctx.font = "24px Tahoma";
        ctx.textAlign = "center";
        const bob = Math.sin(ship.waveOffset * 1.5) * 3;
        ctx.fillText("⛵", seaWidth * 0.4, rMarine.cy - 45 + bob);

        if (ship.active) {
            const cycle = Math.sin(ship.animProgress * Math.PI);
            const sy = rMarine.cy - cycle * (canvas.height * 0.5);
            ctx.fillText("🚢", seaWidth * 0.55, sy);
        } else {
            ctx.fillText("🚢", seaWidth * 0.55, rMarine.cy + 5 + bob);
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

            ctx.save();
            ctx.strokeStyle = arrow.color;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(rFrom.cx, rFrom.cy);
            ctx.lineTo(curX, curY);
            ctx.stroke();
            ctx.restore();
        });
    }

    function drawBuildings() {
        buildings.forEach((b) => {
            const r = getBuildingRect(b);
            ctx.fillStyle = b.color;
            ctx.strokeStyle = b.border;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.roundRect(r.x, r.y, r.w, r.h, 10);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 11px Tahoma";
            ctx.textAlign = "center";
            ctx.fillText(b.name, r.cx, r.y + 16);

            if (b.type === "company") {
                ctx.fillStyle = "#fde047";
                ctx.font = "10px Tahoma";
                ctx.fillText(`ميزانية: ${(b.budget / 1000).toFixed(0)}k | شهرة: ${(b.fame / 1000).toFixed(1)}k`, r.cx, r.y + 30);
                drawDesk(r.cx, r.y + 44, "#facc15");
                for (let i = 0; i < b.employees; i++) {
                    const col = i % 2;
                    const row = Math.floor(i / 2);
                    drawDesk(r.x + 40 + col * 75, r.y + 75 + row * 28, "#38bdf8");
                }
            } else if (b.id === "airport") {
                ctx.fillStyle = "#334155";
                ctx.fillRect(r.x + 10, r.cy + 6, r.w - 20, 18);
                ctx.fillStyle = "#7dd3fc";
                ctx.font = "10px Tahoma";
                ctx.fillText(plane.active ? `طيران (${plane.secondsLeft}ث)` : "مدرج المطار الدولي", r.cx, r.y + 30);
            } else if (b.id === "store") {
                ctx.fillStyle = "#fed7aa";
                ctx.font = "10px Tahoma";
                ctx.fillText(`مخزون: ${Math.floor(state.storeStock).toLocaleString()} | ضريبة: ${state.taxRate.toFixed(1)}%`, r.cx, r.y + 34);
            } else if (b.id === "bank") {
                ctx.fillStyle = "#93c5fd";
                ctx.font = "10px Tahoma";
                ctx.fillText(`قروض: ${state.bankLoans}/3 | العملة: SAR`, r.cx, r.y + 34);
            }
        });
    }

    function drawDesk(x, y, color) {
        ctx.fillStyle = "#d97706";
        ctx.fillRect(x - 10, y - 3, 20, 7);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y + 6, 4, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawVehiclesAndPlayer() {
        const rAir = getBuildingRect(buildings.find(b => b.id === "airport"));
        if (!plane.active) {
            ctx.font = "22px Tahoma";
            ctx.textAlign = "center";
            ctx.fillText("✈️", rAir.x + 28, rAir.cy + 22);
        } else {
            const p = plane.animProgress;
            let px = rAir.cx + (p - 0.5) * 160;
            let py = rAir.cy - Math.sin(p * Math.PI) * 70;
            ctx.font = "24px Tahoma";
            ctx.textAlign = "center";
            ctx.fillText("✈️", px, py);
        }

        if (truck.active) {
            const rm = getBuildingRect(buildings.find(b => b.id === "marine"));
            const re = getBuildingRect(buildings.find(b => b.id === "edu"));
            ctx.font = "22px Tahoma";
            ctx.textAlign = "center";
            ctx.fillText("🚚", rm.cx + (re.cx - rm.cx) * truck.progress, rm.cy + (re.cy - rm.cy) * truck.progress);
        }

        ctx.fillStyle = "#ef4444";
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.font = "13px Tahoma";
        ctx.textAlign = "center";
        ctx.fillText("🧑‍💼", player.x, player.y + 4);
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
