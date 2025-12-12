/**
 * Schedule Generator & Optimization
 */

function updateNextMonthLastHolidays(currentYM) {
    const nextYM = getNextMonth(currentYM);
    let counted = 0;
    const updates = [];

    state.members.forEach(m => {
        // Find last holiday in CURRENT generated month
        const lastHoliday = findLastHolidayInMonth(m.id, currentYM);

        if (lastHoliday) {
            if (!state.lastHolidays) state.lastHolidays = {};
            if (!state.lastHolidays[nextYM]) state.lastHolidays[nextYM] = {};

            // Always overwrite is safer for "Auto Update"
            const oldVal = state.lastHolidays[nextYM][m.id];
            state.lastHolidays[nextYM][m.id] = lastHoliday;

            if (oldVal !== lastHoliday) {
                counted++;
                updates.push(`${m.name}:${lastHoliday.slice(8)}`);
            }
        }
    });

    if (counted > 0) {
        console.log(`Updated next month (${nextYM}) last holidays for ${counted} members:`, updates);
        // Show example in toast to prove update
        const example = updates.length > 0 ? ` (例: ${updates[0]})` : '';
        if (window.showToast) showToast(`翌月(${nextYM})の[前月最終休日]を更新しました (${counted}名${example})`, "success");
    } else {
        console.log(`Checked next month (${nextYM}) update. No changes necessary or no holidays found.`);
    }
}

async function resetSchedule() {
    if (!await window.showConfirm("現在のシフトと固定設定を全てリセットしますか？")) return;
    state.shifts = {};
    state.fixed = {};
    saveState();
    if (window.render) render();
}

async function generateSchedule(retryCount = 0) {
    // Show Progress UI
    const progressModal = document.getElementById('progress-modal');
    console.log('Starting generation...', progressModal);

    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');

    if (retryCount === 0) {
        if (progressModal) {
            progressModal.style.setProperty('display', 'flex', 'important');
        } else {
            console.error("Progress Modal element not found!");
            window.showAlert("Error: Progress Modal not found", "エラー");
        }

        if (progressBar) progressBar.style.width = '0%';
        if (progressText) progressText.textContent = '0%';

        // Allow UI to render
        await new Promise(r => setTimeout(r, 50));
    }

    try {
        const dates = getDaysInMonth(state.settings.yearMonth);
        const workDays = dates.filter(isWorkDay);

        // Helper: Check if fixed
        const checkFixed = (dateStr, mId) => state.fixed[dateStr] && state.fixed[dateStr][mId];

        // 1. Initialize Shifts (Preserve other months)
        // Clone existing shifts
        const newShifts = { ...state.shifts };

        // Clear current month's non-fixed shifts
        dates.forEach(d => {
            const dateStr = formatDate(d);

            // Sync fixed data rigorously
            if (state.fixed[dateStr]) {
                if (!newShifts[dateStr]) newShifts[dateStr] = {};
                Object.assign(newShifts[dateStr], state.fixed[dateStr]);
            }

            // Clear non-fixed shifts for this date to ensure re-generation
            if (newShifts[dateStr]) {
                state.members.forEach(m => {
                    // If member is NOT fixed for this date, clear their slot
                    if (!state.fixed[dateStr] || !state.fixed[dateStr][m.id]) {
                        delete newShifts[dateStr][m.id];
                    }
                });
            }
        });

        // Update state reference to this working copy
        state.shifts = newShifts;

        const activeMembers = getActiveMembers();

        // 2. Initial Random Fill (Satisfy Quotas)
        activeMembers.forEach(m => {
            // A. Set Non-Work Days to OFF (unless fixed to something else)
            dates.forEach(d => {
                const dateStr = formatDate(d);
                if (!isWorkDay(d)) {
                    if (!getShift(dateStr, m.id)) setShift(dateStr, m.id, 'OFF');
                }
            });

            // B. Calculate Target Work Days
            // Target = TotalDays - BaseOff - TeamBaseOff
            const totalDays = dates.length;
            const targetWork = Math.max(0, totalDays - state.settings.baseOff - (m.extraOff || 0));

            // Count current fixed Work
            let currentWork = 0;
            let availableWorkDays = [];

            dates.forEach(d => {
                const dateStr = formatDate(d);
                // Only consider WorkDays for assignment pool
                if (isWorkDay(d)) {
                    const s = getShift(dateStr, m.id);
                    if (s === 'ON_SITE' || s === 'TRIP' || s === 'HALF_AM' || s === 'HALF_PM') {
                        currentWork++;
                    } else if (!s) {
                        availableWorkDays.push(dateStr);
                    }
                } else {
                    // Non-work day. Check if Fixed Work
                    const s = getShift(dateStr, m.id);
                    if (s === 'ON_SITE' || s === 'TRIP') currentWork++;
                }
            });

            const neededWork = targetWork - currentWork;

            // Shuffle available
            const sortedAvailable = [...availableWorkDays];
            for (let i = sortedAvailable.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [sortedAvailable[i], sortedAvailable[j]] = [sortedAvailable[j], sortedAvailable[i]];
            }

            sortedAvailable.forEach((dateStr, idx) => {
                if (idx < neededWork) {
                    // Assign correct shift type based on weekday setting
                    const date = new Date(dateStr);
                    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
                    const dayKey = dayNames[date.getDay()];
                    const setting = state.settings.workDays[dayKey];

                    let shiftType = 'ON_SITE';
                    if (setting === 'HALF_AM') shiftType = 'HALF_AM';
                    else if (setting === 'HALF_PM') shiftType = 'HALF_PM';

                    setShift(dateStr, m.id, shiftType);
                } else {
                    setShift(dateStr, m.id, 'OFF');
                }
            });
        });

        // 3. Optimization Loop (Swap-based Hill Climbing)

        // Pre-calculate Last Holidays to avoid repeated calls in loop
        const cachedLastHolidays = {};
        activeMembers.forEach(m => {
            cachedLastHolidays[m.id] = getLastHoliday(m.id);
        });

        function calculateScore() {
            let score = 0;

            // A. Daily Variance & Targets
            let minCount = 9999;
            let maxCount = -1;

            workDays.forEach(d => {
                const dateStr = formatDate(d);
                let count = 0;

                // Track team counts for daily balance
                const teamCounts = {};
                state.teams.forEach(t => teamCounts[t.id] = 0);

                activeMembers.forEach(m => {
                    const s = getShift(dateStr, m.id);
                    const val = getShiftDays(s);
                    count += val;

                    if (val > 0 && m.teamId && teamCounts[m.teamId] !== undefined) {
                        teamCounts[m.teamId] += val;
                    }
                });

                // Target Headcount Constraint
                const target = state.dailyTargets && state.dailyTargets[dateStr];
                if (target !== undefined && target !== null && target !== '') {
                    const diff = Math.abs(count - parseInt(target));
                    if (diff > 0) score += diff * 5000;

                    // Daily Team Balance Penalty
                    let tMin = 9999, tMax = -1;
                    state.teams.forEach(t => {
                        const c = teamCounts[t.id];
                        if (c < tMin) tMin = c;
                        if (c > tMax) tMax = c;
                    });

                    if (tMax !== -1) {
                        const diff = tMax - tMin;
                        if (diff >= 2) {
                            score += diff * 50000;
                        } else if (diff >= 1) {
                            score += 500;
                        }
                    }
                }

                // Variance tracking
                const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
                const dayKey = dayNames[d.getDay()];
                const setting = state.settings.workDays[dayKey];

                if (setting !== 'HALF_AM' && setting !== 'HALF_PM' && setting !== 'OFF') {
                    const hasTarget = state.dailyTargets && state.dailyTargets[dateStr] !== undefined && state.dailyTargets[dateStr] !== null && state.dailyTargets[dateStr] !== '';
                    if (!hasTarget) {
                        if (count < minCount) minCount = count;
                        if (count > maxCount) maxCount = count;
                    }
                }

                // Smoothing
                score += (count * count) * 10;
            });

            // Strict Variance Penalty (Global)
            if (maxCount !== -1 && (maxCount - minCount) >= 2) {
                const diff = maxCount - minCount;
                score += diff * 10000;
            }

            // Strict Variance Penalty (Per Team)
            state.teams.forEach(t => {
                const teamMembers = activeMembers.filter(m => m.teamId === t.id);
                if (teamMembers.length === 0) return;

                let tMin = 9999, tMax = -1;
                workDays.forEach(d => {
                    const dateStr = formatDate(d);
                    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
                    const setting = state.settings.workDays[dayNames[d.getDay()]];
                    const hasTarget = state.dailyTargets && state.dailyTargets[dateStr];

                    if (setting === 'HALF_AM' || setting === 'HALF_PM' || setting === 'OFF' || hasTarget) return;

                    let c = 0;
                    teamMembers.forEach(m => c += getShiftDays(getShift(dateStr, m.id)));
                    if (c < tMin) tMin = c;
                    if (c > tMax) tMax = c;
                });

                if (tMax !== -1 && (tMax - tMin) >= 2) {
                    const diff = tMax - tMin;
                    score += diff * 8000;
                }
            });

            // B. Consecutive Shifts
            const limit = state.settings.maxConsecutive || 5;
            activeMembers.forEach(m => {
                let consecutive = 0;

                // Initialize from last holiday
                const lh = cachedLastHolidays[m.id];
                if (lh) {
                    const startOfMonth = dates[0];
                    const lhDate = new Date(lh);
                    const diffDays = Math.ceil((startOfMonth - lhDate) / (1000 * 60 * 60 * 24));
                    if (diffDays > 1) consecutive = diffDays - 1;
                }

                dates.forEach(d => {
                    const s = getShift(formatDate(d), m.id);
                    if (getShiftDays(s) > 0) {
                        consecutive++;
                        if (consecutive > limit) score += 1000;
                        score += Math.pow(consecutive, 2) * 10;
                    } else {
                        consecutive = 0;
                    }
                });
            });

            // C. Conditions
            state.conditions.forEach(c => {
                if (!c.m1 || !c.m2) return;
                workDays.forEach(d => {
                    const dateStr = formatDate(d);
                    const s1 = getShift(dateStr, c.m1);
                    const s2 = getShift(dateStr, c.m2);
                    const w1 = (getShiftDays(s1) > 0);
                    const w2 = (getShiftDays(s2) > 0);

                    if (c.type === 'TOGETHER') {
                        if (w1 !== w2) score += 200;
                    } else if (c.type === 'SEPARATE') {
                        if (w1 && w2) score += 200;
                    }
                });
            });

            return score;
        }

        let currentScore = calculateScore();

        // 2-B. Directed Flattening
        const performFlattening = (targetMembers, attemptLimit) => {
            for (let k = 0; k < attemptLimit; k++) {
                // 1. Calculate current counts
                const dailyCounts = {};
                let minC = 9999, maxC = -1;
                let minDates = [], maxDates = [];

                workDays.forEach(d => {
                    const dateStr = formatDate(d);
                    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
                    const setting = state.settings.workDays[dayNames[d.getDay()]];

                    const hasTarget = state.dailyTargets && state.dailyTargets[dateStr] !== undefined && state.dailyTargets[dateStr] !== null && state.dailyTargets[dateStr] !== '';
                    if (setting === 'HALF_AM' || setting === 'HALF_PM' || setting === 'OFF' || hasTarget) return;

                    let c = 0;
                    targetMembers.forEach(m => c += getShiftDays(getShift(dateStr, m.id)));
                    dailyCounts[dateStr] = c;

                    if (c < minC) minC = c;
                    if (c > maxC) maxC = c;
                });

                if (maxC !== -1 && (maxC - minC) < 2) break;

                Object.entries(dailyCounts).forEach(([ds, c]) => {
                    if (c === minC) minDates.push(ds);
                    if (c === maxC) maxDates.push(ds);
                });

                // 2. Try to move a shift from ANY MaxDay -> ANY MinDay
                let moved = false;

                minDates.sort(() => Math.random() - 0.5);
                maxDates.sort(() => Math.random() - 0.5);

                outerLoop:
                for (const maxD of maxDates) {
                    for (const minD of minDates) {
                        if (maxD === minD) continue;

                        const candidates = targetMembers.filter(m => {
                            if (checkFixed(maxD, m.id) || checkFixed(minD, m.id)) return false;
                            const sMax = getShift(maxD, m.id);
                            const sMin = getShift(minD, m.id);
                            return (getShiftDays(sMax) >= 1 && getShiftDays(sMin) === 0 && sMin === 'OFF');
                        });

                        if (candidates.length > 0) {
                            const m = candidates[Math.floor(Math.random() * candidates.length)];

                            const getWorkType = (dString) => {
                                const d = new Date(dString);
                                const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
                                const setting = state.settings.workDays[dayNames[d.getDay()]];
                                if (setting === 'HALF_AM') return 'HALF_AM';
                                if (setting === 'HALF_PM') return 'HALF_PM';
                                return 'ON_SITE';
                            };

                            const newSMin = getWorkType(minD);

                            setShift(maxD, m.id, 'OFF');
                            setShift(minD, m.id, newSMin);

                            moved = true;
                            break outerLoop;
                        }
                    }
                }
                if (!moved) break;
            }
        };

        // Phase 1: Flatten Per Team
        state.teams.forEach(t => {
            const teamMembers = activeMembers.filter(m => m.teamId === t.id);
            if (teamMembers.length > 0) {
                performFlattening(teamMembers, 200);
            }
        });

        // Phase 2: Flatten Global
        performFlattening(activeMembers, 500);

        currentScore = calculateScore();

        // Get optimization strength from UI (global els)
        const strength = window.els && window.els.optimizationStrength ? window.els.optimizationStrength.value : 'medium';
        const ITERATIONS = {
            'weak': 3000,
            'medium': 10000,
            'strong': 30000,
            'strongest': 300000
        }[strength] || 10000;

        const CHUNK_SIZE = 1000;
        for (let i = 0; i < ITERATIONS; i++) {
            const m = state.members[Math.floor(Math.random() * state.members.length)];
            const mWorkDays = state.settings.workDays;

            const assignableDates = dates.filter(d => {
                return isWorkDay(d);
            });

            if (assignableDates.length < 2) continue;

            const d1 = assignableDates[Math.floor(Math.random() * assignableDates.length)];
            const d2 = assignableDates[Math.floor(Math.random() * assignableDates.length)];

            const dateStr1 = formatDate(d1);
            const dateStr2 = formatDate(d2);

            if (dateStr1 === dateStr2) continue;
            if (checkFixed(dateStr1, m.id) || checkFixed(dateStr2, m.id)) continue;

            const s1 = getShift(dateStr1, m.id);
            const s2 = getShift(dateStr2, m.id);

            if (s1 === s2) continue;

            const getWorkType = (d) => {
                const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
                const setting = mWorkDays[dayNames[d.getDay()]];
                if (setting === 'HALF_AM') return 'HALF_AM';
                if (setting === 'HALF_PM') return 'HALF_PM';
                return 'ON_SITE';
            };

            const isS1Work = getShiftDays(s1) > 0;
            const isS2Work = getShiftDays(s2) > 0;

            const newS1 = isS2Work ? getWorkType(d1) : 'OFF';
            const newS2 = isS1Work ? getWorkType(d2) : 'OFF';

            setShift(dateStr1, m.id, newS1);
            setShift(dateStr2, m.id, newS2);

            const newScore = calculateScore();

            if (newScore <= currentScore) {
                currentScore = newScore;
            } else {
                setShift(dateStr1, m.id, s1);
                setShift(dateStr2, m.id, s2);
            }

            if (i % CHUNK_SIZE === 0) {
                const percent = Math.round((i / ITERATIONS) * 100);
                if (progressBar) progressBar.style.width = `${percent}%`;
                if (progressText) progressText.textContent = `${percent}%`;
                await new Promise(r => setTimeout(r, 0));
            }
        }

        const finalWarnings = validateSchedule();
        const hasVarianceIssue = finalWarnings.some(w => w.includes('日次出勤人数の差が大きすぎます'));

        if (hasVarianceIssue && retryCount < 5) {
            if (progressText) progressText.textContent = `リトライ中 (${retryCount + 1}/5)...`;
            await new Promise(r => setTimeout(r, 500));
            await generateSchedule(retryCount + 1);
            return;
        }

        updateNextMonthLastHolidays(state.settings.yearMonth);

        saveState();
        if (window.render) render();

        if (progressModal) progressModal.style.display = 'none';

        const warnings = validateSchedule();
        if (warnings.length > 0) {
            const warningMessage = "⚠️ 自動生成が完了しましたが、以下の問題があります:\n\n" + warnings.join('\n');
            if (retryCount > 0) {
                await window.showAlert(warningMessage + `\n\n(${retryCount + 1}回の試行後の最良結果)`, "警告");
            } else {
                await window.showAlert(warningMessage, "警告");
            }
        } else {
            const successMsg = retryCount > 0
                ? `✅ 自動生成が完了しました (${retryCount + 1}回目で成功)`
                : "✅ 自動生成が完了しました";
            if (window.showToast) showToast(successMsg, "success");
        }
    } catch (e) {
        if (progressModal) progressModal.style.display = 'none';
        console.error(e);
        if (window.showToast) showToast("❌ エラーが発生しました: " + e.message, "error");
    }
}

function validateSchedule() {
    const warnings = [];
    const dates = getDaysInMonth(state.settings.yearMonth);
    const workDays = dates.filter(isWorkDay);

    let minCount = 9999;
    let maxCount = -1;
    const dailyCounts = {};

    workDays.forEach(d => {
        const dateStr = formatDate(d);
        let count = 0;
        const list = getActiveMembers();
        list.forEach(m => {
            const s = getShift(dateStr, m.id);
            count += getShiftDays(s);
        });

        dailyCounts[dateStr] = count;
        if (count < minCount) minCount = count;
        if (count > maxCount) maxCount = count;

        const target = state.dailyTargets && state.dailyTargets[dateStr];
        if (target !== undefined && target !== null && target !== '') {
            const targetNum = parseInt(target);
            if (count !== targetNum) {
                warnings.push(`📅 ${dateStr}: 必要${targetNum}人 → 実際${count}人`);
            }
        }
    });

    let validMaxCount = -1;
    let validMinCount = 9999;

    Object.entries(dailyCounts).forEach(([dateStr, count]) => {
        const hasTarget = state.dailyTargets && state.dailyTargets[dateStr];
        if (!hasTarget) {
            if (count > validMaxCount) validMaxCount = count;
            if (count < validMinCount) validMinCount = count;
        }
    });

    if (validMaxCount !== -1 && (validMaxCount - validMinCount) >= 2) {
        warnings.push(`⚠️ 日次出勤人数の差が大きすぎます (最小:${validMinCount}, 最大:${validMaxCount})`);
    }

    return warnings;
}
