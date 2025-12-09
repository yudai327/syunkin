/**
 * Shunkin - Instant Shift
 * Vanilla JS Implementation
 */

// --- Constants ---
const DAYS_JP = ['日', '月', '火', '水', '木', '金', '土'];
const STORAGE_KEY = 'shunkin_v1_data';

// Shift type icons - centralized for consistency
const SHIFT_ICONS = {
    ON_SITE: '🏢',  // Office work
    HALF_AM: '🌅',  // Half day (morning)
    HALF_PM: '🌆',  // Half day (afternoon)
    TRIP: '✈️',     // Business trip
    OFF: '💤'       // Day off
};

// Shift type labels
const SHIFT_LABELS = {
    ON_SITE: '出勤',
    HALF_AM: 'AM休',
    HALF_PM: 'PM休',
    TRIP: '出張',
    OFF: '休日'
};

// --- State ---
let state = {
    settings: {
        yearMonth: new Date().toISOString().slice(0, 7), // "YYYY-MM"
        workDays: {
            mon: 'WORK',
            tue: 'WORK',
            wed: 'WORK',
            thu: 'WORK',
            fri: 'WORK',
            sat: 'OFF',
            sun: 'OFF'
        },
        baseOff: 8, // default days off per month
        maxConsecutive: 5 // limit consecutive work days
    },
    members: [
        { id: 'm1', name: '佐藤', extraOff: 0 },
        { id: 'm2', name: '鈴木', extraOff: 0 },
        { id: 'm3', name: '高橋', extraOff: 0 },
        { id: 'm4', name: '田中', extraOff: 1 }
    ],
    // Map: "YYYY-MM-DD" -> { memberId: "ON_SITE" | "OFF" | "TRIP" }
    shifts: {},
    // Constraints: { "YYYY-MM-DD": { memberId: "OFF" | "TRIP" } }
    // Constraints: { "YYYY-MM-DD": { memberId: "OFF" | "TRIP" } }
    fixed: {},
    // Conditions: [{ type: 'TOGETHER'|'SEPARATE', m1: id, m2: id }]
    conditions: []
};

// --- DOM Elements ---
const els = {
    monthInput: document.getElementById('month-picker'),
    calendarGrid: document.getElementById('calendar-grid'),
    memberList: document.getElementById('member-list'),
    statWorkDays: document.getElementById('stat-workdays'),
    statTotalSlots: document.getElementById('stat-total-slots'),
    // Weekday settings
    dayMon: document.getElementById('day-mon'),
    dayTue: document.getElementById('day-tue'),
    dayWed: document.getElementById('day-wed'),
    dayThu: document.getElementById('day-thu'),
    dayFri: document.getElementById('day-fri'),
    daySat: document.getElementById('day-sat'),
    daySun: document.getElementById('day-sun'),
    btnGenerate: document.getElementById('btn-generate'),
    btnReset: document.getElementById('btn-reset'),
    btnPrint: document.getElementById('btn-print'),
    btnExport: document.getElementById('btn-export'),
    btnImport: document.getElementById('btn-import'),
    fileImport: document.getElementById('file-import'),
    btnAddMember: document.getElementById('btn-add-member'),
    optimizationStrength: document.getElementById('optimization-strength')
};

// --- Initialization ---
// Update input values from state
function updateUIInputs() {
    // Set initial input values
    if (els.monthInput) els.monthInput.value = state.settings.yearMonth;

    // Set weekday dropdowns
    const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    days.forEach(day => {
        const key = 'day' + day.charAt(0).toUpperCase() + day.slice(1);
        if (els[key]) {
            // Default to OFF for sat/sun if undefined, WORK for others
            // Only if state.settings.workDays exists (safety)
            const wd = state.settings.workDays || {};
            els[key].value = wd[day] || (day === 'sat' || day === 'sun' ? 'OFF' : 'WORK');
        }
    });
}

// --- Initialization ---
function init() {
    loadState();
    updateUIInputs();

    // Attach Events
    els.monthInput.addEventListener('change', (e) => updateSetting('yearMonth', e.target.value));

    // Weekday settings events
    const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    days.forEach(day => {
        const key = 'day' + day.charAt(0).toUpperCase() + day.slice(1);
        if (els[key]) {
            els[key].addEventListener('change', (e) => updateWorkDay(day, e.target.value));
        }
    });

    els.btnGenerate.addEventListener('click', generateSchedule);
    els.btnReset.addEventListener('click', resetSchedule);
    els.btnPrint.addEventListener('click', () => window.print());
    els.btnAddMember.addEventListener('click', addMember);

    render();
}

// --- Logic: Core ---

function getDaysInMonth(yearMonth) {
    const [y, m] = yearMonth.split('-').map(Number);
    const date = new Date(y, m - 1, 1);
    const days = [];
    while (date.getMonth() === m - 1) {
        days.push(new Date(date));
        date.setDate(date.getDate() + 1);
    }
    return days;
}


function isWorkDay(date) {
    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const dayKey = dayNames[date.getDay()];
    const setting = state.settings.workDays[dayKey];

    // Global setting check
    if (setting === 'OFF') return false;
    // Note: HALF_AM and HALF_PM are considered work days for generation purposes

    // Check if all members are fixed as OFF for this date
    const dateStr = formatDate(date);
    if (state.fixed[dateStr] && state.members.length > 0) {
        const allOff = state.members.every(m =>
            state.fixed[dateStr][m.id] === 'OFF'
        );
        if (allOff) return false; // Treat as non-work day
    }

    return true;
}

function formatDate(d) {
    const year = d.getFullYear();
    const month = ('0' + (d.getMonth() + 1)).slice(-2);
    const day = ('0' + d.getDate()).slice(-2);
    return `${year}-${month}-${day}`;
}

function getShift(dateStr, memberId) {
    if (state.fixed[dateStr] && state.fixed[dateStr][memberId]) {
        return state.fixed[dateStr][memberId];
    }
    return state.shifts[dateStr] && state.shifts[dateStr][memberId];
}

// Get the number of work days for a shift type
function getShiftDays(shiftType) {
    if (shiftType === 'ON_SITE' || shiftType === 'TRIP') return 1;
    if (shiftType === 'HALF_AM' || shiftType === 'HALF_PM') return 0.5;
    return 0; // OFF or null
}

function setShift(dateStr, memberId, type) {
    if (!state.shifts[dateStr]) state.shifts[dateStr] = {};
    state.shifts[dateStr][memberId] = type;
}

function toggleLock(dateStr, memberId) {
    if (state.fixed[dateStr] && state.fixed[dateStr][memberId]) {
        // Unlock
        delete state.fixed[dateStr][memberId];
        if (Object.keys(state.fixed[dateStr]).length === 0) {
            delete state.fixed[dateStr];
        }
    } else {
        // Lock
        if (!state.fixed[dateStr]) state.fixed[dateStr] = {};
        const current = getShift(dateStr, memberId) || 'OFF';
        state.fixed[dateStr][memberId] = current;
        setShift(dateStr, memberId, current);
    }
    saveState();
    render();
}

function toggleDayLock(dateStr) {
    const allLocked = state.members.every(m => isFixed(dateStr, m.id));
    if (allLocked) {
        if (state.fixed[dateStr]) delete state.fixed[dateStr];
    } else {
        if (!state.fixed[dateStr]) state.fixed[dateStr] = {};
        state.members.forEach(m => {
            const current = getShift(dateStr, m.id) || 'OFF';
            state.fixed[dateStr][m.id] = current;
            setShift(dateStr, m.id, current);
        });
    }
    saveState();
    render();
}

// Expose
window.toggleLock = toggleLock;
window.toggleDayLock = toggleDayLock;

function isFixed(dateStr, memberId) {
    return state.fixed[dateStr] && state.fixed[dateStr][memberId];
}

function updateSetting(key, value) {
    state.settings[key] = value;
    saveState();
    render();
}

function updateWorkDay(dayKey, value) {
    state.settings.workDays[dayKey] = value;
    saveState();
    render();
}

function addMember() {
    const name = prompt("メンバー名を入力してください:", "New Member");
    if (!name) return;
    const id = 'm' + Date.now();
    state.members.push({ id, name, extraOff: 0 });
    saveState();
    renderSidebar();
}

function deleteMember(id) {
    if (!confirm("削除しますか?")) return;
    state.members = state.members.filter(m => m.id !== id);
    // Cleanup shifts
    render();
    saveState();
}
window.deleteMember = deleteMember;

window.addCondition = function () {
    state.conditions.push({ type: 'TOGETHER', m1: '', m2: '' });
    renderSidebar();
    saveState();
};

window.updateCondition = function (idx, key, val) {
    state.conditions[idx][key] = val;
    saveState();
};

window.deleteCondition = function (idx) {
    state.conditions.splice(idx, 1);
    renderSidebar();
    saveState();
};

// --- Daily Targets & Notes ---
window.handleHeaderClick = function (dateStr) {
    // Left Click: Set Headcount Target
    const current = state.dailyTargets && state.dailyTargets[dateStr] || '';
    const input = prompt(`${dateStr}\n目標出勤人数を入力してください (空欄で解除):`, current);
    if (input === null) return;

    if (!state.dailyTargets) state.dailyTargets = {};

    if (input.trim() === '') {
        delete state.dailyTargets[dateStr];
    } else {
        const num = parseInt(input);
        if (!isNaN(num)) state.dailyTargets[dateStr] = num;
    }
    saveState();
    render();
};

window.handleHeaderRightClick = function (e, dateStr) {
    // Right Click: Set Note/Event
    e.preventDefault();
    const current = state.dailyNotes && state.dailyNotes[dateStr] || '';
    const input = prompt(`${dateStr}\n行事・メモを入力してください (空欄で解除):`, current);
    if (input === null) return;

    if (!state.dailyNotes) state.dailyNotes = {};

    if (input.trim() === '') {
        delete state.dailyNotes[dateStr];
    } else {
        state.dailyNotes[dateStr] = input;
    }
    saveState();
    render();
};

// --- Logic: Generator (Heuristic) ---
// --- Logic: Generator (Optimization) ---
function resetSchedule() {
    if (!confirm("現在のシフトと固定設定を全てリセットしますか？")) return;
    state.shifts = {};
    state.fixed = {};
    saveState();
    render();
}

function generateSchedule(retryCount = 0) {
    try {
        const dates = getDaysInMonth(state.settings.yearMonth);
        const workDays = dates.filter(isWorkDay);

        // Helper: Check if fixed
        const isFixed = (dateStr, mId) => state.fixed[dateStr] && state.fixed[dateStr][mId];

        // 1. Initialize Shifts
        const newShifts = {};
        // Copy fixed
        Object.keys(state.fixed || {}).forEach(date => {
            if (!newShifts[date]) newShifts[date] = {};
            Object.keys(state.fixed[date]).forEach(mId => {
                newShifts[date][mId] = state.fixed[date][mId];
            });
        });
        state.shifts = newShifts;

        // 2. Initial Random Fill (Satisfy Quotas)
        state.members.forEach(m => {
            // A. Set Non-Work Days to OFF (unless fixed to something else)
            dates.forEach(d => {
                const dateStr = formatDate(d);
                if (!isWorkDay(d)) {
                    if (!getShift(dateStr, m.id)) setShift(dateStr, m.id, 'OFF');
                }
            });

            // B. Calculate Remaining OFFs needed (Total Days - BaseOff - ExtraOff) -> Work Days
            // Actually simplest is: Target Work Days = Total DaysInMonth - (BaseOff + ExtraOff).
            // If Target < 0, 0.
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
                    if (s === 'ON_SITE' || s === 'TRIP') {
                        currentWork++;
                    } else if (!s) {
                        availableWorkDays.push(dateStr);
                    }
                    // If Fixed OFF, it ignores.
                } else {
                    // Non-work day. Check if Fixed Work (rare but possible)
                    const s = getShift(dateStr, m.id);
                    if (s === 'ON_SITE' || s === 'TRIP') currentWork++;
                }
            });

            const neededWork = targetWork - currentWork;

            // Prioritize Mon-Fri for Work assignment
            // If we just shuffle all, specific weekdays (Mon-Fri) might be dropped for Saturday.
            // User likely wants Mon-Fri to be 'Base' work, and Saturday to be 'Extra' if quota allows.
            const priorityDays = []; // Mon-Fri
            const secondaryDays = []; // Sat (if enabled)

            availableWorkDays.forEach(ds => {
                const date = new Date(ds); // naive parse
                const day = date.getDay();
                if (day >= 1 && day <= 5) priorityDays.push(ds);
                else secondaryDays.push(ds);
            });

            // Shuffle each group
            priorityDays.sort(() => Math.random() - 0.5);
            secondaryDays.sort(() => Math.random() - 0.5);

            // Combine: Priority first
            // If neededWork < priorityDays.length, we drop some Mon-Fri (unavoidable if high baseOff)
            // If neededWork > priorityDays.length, we fill all Mon-Fri and take some Sat.
            const sortedAvailable = [...priorityDays, ...secondaryDays];

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
        // Goal: Minimize Variance of Daily Attendance + Penalty for Consecutive > N + Conditions

        function calculateScore() {
            let score = 0;

            // A. Daily Variance & Targets
            // Target: Flat distribution across WorkDays (Diff < 2)
            // AND specific daily targets
            let minCount = 9999;
            let maxCount = -1;

            workDays.forEach(d => {
                const dateStr = formatDate(d);
                let count = 0;
                state.members.forEach(m => {
                    const s = getShift(dateStr, m.id);
                    count += getShiftDays(s);
                });

                // Target Headcount Constraint
                const target = state.dailyTargets && state.dailyTargets[dateStr];
                if (target !== undefined && target !== null && target !== '') {
                    const diff = Math.abs(count - parseInt(target));
                    if (diff > 0) score += diff * 5000; // Major penalty for missing target
                }

                // Variance tracking
                if (count < minCount) minCount = count;
                if (count > maxCount) maxCount = count;

                score += (count * count) * 10; // Smoothing weight
            });

            // Strict Variance Penalty (Max - Min must be < 2, i.e. 0 or 1)
            if ((maxCount - minCount) >= 2) {
                score += 2000; // Significant penalty to force flatness
            }

            // B. Consecutive Shifts (Penalty for > N)
            const limit = state.settings.maxConsecutive || 5;
            state.members.forEach(m => {
                let consecutive = 0;
                dates.forEach(d => {
                    const s = getShift(formatDate(d), m.id);
                    if (getShiftDays(s) > 0) { // Any work (full or half day)
                        consecutive++;
                        if (consecutive > limit) score += 1000; // Heavy Penalty
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
                    const w1 = (s1 === 'ON_SITE' || s1 === 'TRIP');
                    const w2 = (s2 === 'ON_SITE' || s2 === 'TRIP');

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

        // Get optimization strength from UI
        const strength = els.optimizationStrength ? els.optimizationStrength.value : 'medium';
        const ITERATIONS = {
            'weak': 3000,      // 弱: 速い、精度は低め
            'medium': 10000,   // 中: バランス (デフォルト)
            'strong': 30000    // 強: 遅いが高精度
        }[strength];

        for (let i = 0; i < ITERATIONS; i++) {
            // Pick Member
            const m = state.members[Math.floor(Math.random() * state.members.length)];

            // Pick 2 Work Days to swap
            // (Swapping preserves total work count, so Quota is invariant)
            const d1 = workDays[Math.floor(Math.random() * workDays.length)];
            const d2 = workDays[Math.floor(Math.random() * workDays.length)];

            const dateStr1 = formatDate(d1);
            const dateStr2 = formatDate(d2);

            if (dateStr1 === dateStr2) continue;
            if (isFixed(dateStr1, m.id) || isFixed(dateStr2, m.id)) continue;

            const s1 = getShift(dateStr1, m.id);
            const s2 = getShift(dateStr2, m.id);

            if (s1 === s2) continue; // No functional change

            // Try Swap
            // When moving "Work" to a new date, respect that date's weekday setting (Full/Half)
            const getWorkType = (dString) => {
                const d = new Date(dString);
                const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
                const setting = state.settings.workDays[dayNames[d.getDay()]];
                if (setting === 'HALF_AM') return 'HALF_AM';
                if (setting === 'HALF_PM') return 'HALF_PM';
                return 'ON_SITE';
            };

            const isS1Work = s1 && s1 !== 'OFF';
            const isS2Work = s2 && s2 !== 'OFF';

            const newS1 = isS2Work ? getWorkType(dateStr1) : 'OFF';
            const newS2 = isS1Work ? getWorkType(dateStr2) : 'OFF';

            setShift(dateStr1, m.id, newS1);
            setShift(dateStr2, m.id, newS2);

            const newScore = calculateScore();

            if (newScore <= currentScore) {
                // Accept
                currentScore = newScore;
            } else {
                // Revert
                setShift(dateStr1, m.id, s1);
                setShift(dateStr2, m.id, s2);
            }
        }

        // Check if we need to retry with different initial shuffle
        const finalWarnings = validateSchedule();
        const hasVarianceIssue = finalWarnings.some(w => w.includes('日次出勤人数の差が大きすぎます'));

        if (hasVarianceIssue && retryCount < 5) {
            // Show retry notification
            showToast(`🔄 より良い結果を探しています... (試行 ${retryCount + 1}/5)`, "warning");
            // Retry with different random seed
            return generateSchedule(retryCount + 1);
        }

        saveState();
        render();

        // Validate and show warnings
        const warnings = validateSchedule();
        if (warnings.length > 0) {
            const warningMessage = "⚠️ 自動生成が完了しましたが、以下の問題があります:\n\n" + warnings.join('\n');
            if (retryCount > 0) {
                alert(warningMessage + `\n\n(${retryCount + 1}回の試行後の最良結果)`);
            } else {
                alert(warningMessage);
            }
        } else {
            const successMsg = retryCount > 0
                ? `✅ 自動生成が完了しました (${retryCount + 1}回目で成功)`
                : "✅ 自動生成が完了しました";
            showToast(successMsg, "success");
        }
    } catch (e) {
        console.error(e);
        showToast("❌ エラーが発生しました: " + e.message, "error");
    }
}

// Validate generated schedule
function validateSchedule() {
    const warnings = [];
    const dates = getDaysInMonth(state.settings.yearMonth);
    const workDays = dates.filter(isWorkDay);

    // Check daily variance
    let minCount = 9999;
    let maxCount = -1;
    const dailyCounts = {};

    workDays.forEach(d => {
        const dateStr = formatDate(d);
        let count = 0;
        state.members.forEach(m => {
            const s = getShift(dateStr, m.id);
            count += getShiftDays(s);
        });

        dailyCounts[dateStr] = count;
        if (count < minCount) minCount = count;
        if (count > maxCount) maxCount = count;

        // Check daily targets
        const target = state.dailyTargets && state.dailyTargets[dateStr];
        if (target !== undefined && target !== null && target !== '') {
            const targetNum = parseInt(target);
            if (count !== targetNum) {
                warnings.push(`📅 ${dateStr}: 目標${targetNum}人 → 実際${count}人`);
            }
        }
    });

    // Check variance (difference >= 2)
    // Check variance (difference >= 2)
    // DISABLED per user request: "メッセージ不要" avoiding automated retries and alerts for variance.
    /*
    const variance = maxCount - minCount;
    if (variance >= 2) {
        // Find dates with max and min counts
        const maxDates = [];
        const minDates = [];
 
        Object.entries(dailyCounts).forEach(([dateStr, count]) => {
            if (count === maxCount) maxDates.push(dateStr);
            if (count === minCount) minDates.push(dateStr);
        });
 
        warnings.push(`📊 日次出勤人数の差が大きすぎます: 最大${maxCount}人 - 最小${minCount}人 = ${variance}人差`);
        warnings.push(`   最大: ${maxDates.join(', ')} (${maxCount}人)`);
        warnings.push(`   最小: ${minDates.join(', ')} (${minCount}人)`);
        warnings.push(`   推奨: 差を1人以内に抑えるため、連続勤務制限を緩和するか、メンバー数を調整してください`);
    }
    */

    // Check if fixed shifts are causing variance issues
    // DISABLED: variance logic removed
    /*
    if (variance >= 2) {
        const fixedIssues = analyzeFixedShiftImpact(workDays, dailyCounts, maxCount, minCount);
        if (fixedIssues.length > 0) {
            warnings.push(`⚠️ 固定設定が出勤人数の偏りを引き起こしています:`);
            fixedIssues.forEach(issue => warnings.push(`   ${issue}`));
        }
    }
    */

    // Check consecutive work days
    const limit = state.settings.maxConsecutive || 5;
    state.members.forEach(m => {
        let consecutive = 0;
        let maxConsecutive = 0;
        let violationDates = [];

        dates.forEach(d => {
            const s = getShift(formatDate(d), m.id);
            if (getShiftDays(s) > 0) { // Any work (full or half day)
                consecutive++;
                if (consecutive > maxConsecutive) maxConsecutive = consecutive;
                if (consecutive > limit) {
                    violationDates.push(formatDate(d));
                }
            } else {
                consecutive = 0;
            }
        });

        if (maxConsecutive > limit) {
            warnings.push(`👤 ${m.name}: 連続${maxConsecutive}日勤務 (制限: ${limit}日)`);
        }
    });

    return warnings;
}

// Analyze how fixed shifts contribute to variance
function analyzeFixedShiftImpact(workDays, dailyCounts, maxCount, minCount) {
    const issues = [];

    // Find dates with max and min counts
    const maxDates = [];
    const minDates = [];

    Object.entries(dailyCounts).forEach(([dateStr, count]) => {
        if (count === maxCount) maxDates.push(dateStr);
        if (count === minCount) minDates.push(dateStr);
    });

    // Analyze max dates - check for excessive fixed ON_SITE
    maxDates.forEach(dateStr => {
        const fixedOnSite = [];
        state.members.forEach(m => {
            if (state.fixed[dateStr] && state.fixed[dateStr][m.id] === 'ON_SITE') {
                fixedOnSite.push(m.name);
            }
        });

        if (fixedOnSite.length > 0) {
            issues.push(`📅 ${dateStr}: ${fixedOnSite.length}人が出勤固定 → ${fixedOnSite.join(', ')}`);
        }
    });

    // Analyze min dates - check for excessive fixed OFF
    minDates.forEach(dateStr => {
        const fixedOff = [];
        state.members.forEach(m => {
            if (state.fixed[dateStr] && state.fixed[dateStr][m.id] === 'OFF') {
                fixedOff.push(m.name);
            }
        });

        if (fixedOff.length > 0) {
            issues.push(`📅 ${dateStr}: ${fixedOff.length}人が休日固定 → ${fixedOff.join(', ')}`);
        }
    });

    return issues;
}

// --- Interaction Logic ---

// Toggle Status (Click)
function toggleShiftStatus(dateStr, memberId) {
    if (state.fixed[dateStr] && state.fixed[dateStr][memberId]) {
        alert("固定(ロック)されています。解除するには右クリックしてください。");
        return;
    }

    // Safe access
    if (!state.shifts[dateStr]) state.shifts[dateStr] = {};
    const current = state.shifts[dateStr][memberId];

    // Cycle: ON_SITE → TRIP → OFF → HALF_AM → HALF_PM → ON_SITE
    let next = 'ON_SITE';
    if (current === 'ON_SITE') next = 'TRIP';
    else if (current === 'TRIP') next = 'OFF';
    else if (current === 'OFF') next = 'HALF_AM';
    else if (current === 'HALF_AM') next = 'HALF_PM';
    else if (current === 'HALF_PM') next = 'ON_SITE';

    setShift(dateStr, memberId, next);
    saveState();
    render();
}
window.toggleLock = toggleLock;
window.toggleShiftStatus = toggleShiftStatus;



// Timeline Click (Add or Toggle)
function handleTimelineCellClick(dateStr, memberId) {
    const current = state.shifts[dateStr] && state.shifts[dateStr][memberId];
    if (state.fixed[dateStr] && state.fixed[dateStr][memberId]) {
        alert("固定されています (Locked)");
        return;
    }

    if (!current) {
        // Add as ON_SITE
        setShift(dateStr, memberId, 'ON_SITE');
    } else {
        // Toggle normally
        toggleShiftStatus(dateStr, memberId);
    }
    // Render moved to setShift/toggle
}
window.handleTimelineCellClick = handleTimelineCellClick;



// --- Toast Notification ---
function showToast(message, type = "success") {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    // Add to body
    document.body.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);

    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// --- Context Menu for Calendar ---
function showContextMenu(e, dateStr) {
    // Remove any existing context menu
    const existingMenu = document.getElementById('context-menu');
    if (existingMenu) existingMenu.remove();

    // Create context menu
    const menu = document.createElement('div');
    menu.id = 'context-menu';
    menu.className = 'context-menu';
    menu.style.position = 'fixed';
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';
    menu.style.zIndex = '1000';

    // Store position for re-rendering
    menu.dataset.x = e.clientX;
    menu.dataset.y = e.clientY;
    menu.dataset.dateStr = dateStr;

    // Add header
    const header = document.createElement('div');
    header.className = 'context-menu-header';
    header.textContent = 'メンバーを選択';
    menu.appendChild(header);

    // Add member options
    state.members.forEach(m => {
        const shift = getShift(dateStr, m.id);
        const isLocked = isFixed(dateStr, m.id);

        const item = document.createElement('div');
        item.className = 'context-menu-item';

        // Show current shift with icon (using centralized constants)
        const currentIcon = SHIFT_ICONS[shift] || '';

        item.innerHTML = `${currentIcon} ${m.name}`;
        if (isLocked) {
            item.style.backgroundColor = '#fee2e2';  // Red background for locked shifts
        }

        item.onclick = () => {
            // Show shift type selector for this member
            showShiftTypeSelector(e, dateStr, m.id, menu);
        };

        menu.appendChild(item);
    });

    // "All Members" option removed by user request

    document.body.appendChild(menu);

    // Close menu when clicking outside
    const closeMenu = (event) => {
        if (!menu.contains(event.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
}

// Expose to global scope for HTML event handlers
window.showContextMenu = showContextMenu;
window.showShiftTypeSelector = showShiftTypeSelector;

// Show shift type selector for a specific member
function showShiftTypeSelector(e, dateStr, memberId, parentMenu) {
    // Remove parent menu if provided, otherwise remove any existing menu
    if (parentMenu) {
        parentMenu.remove();
    } else {
        const existing = document.getElementById('context-menu');
        if (existing) existing.remove();
    }

    // Create new menu for shift type selection
    const menu = document.createElement('div');
    menu.id = 'context-menu';
    menu.className = 'context-menu';
    menu.style.position = 'fixed';
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';
    menu.style.zIndex = '1000';

    const member = state.members.find(m => m.id === memberId);
    const currentShift = getShift(dateStr, memberId);
    const isLocked = isFixed(dateStr, memberId);

    // Add header
    const header = document.createElement('div');
    header.className = 'context-menu-header';
    header.textContent = `${member.name} - シフト選択`;
    menu.appendChild(header);

    // Build shift type options from constants
    const shiftTypes = Object.keys(SHIFT_ICONS).map(type => ({
        type: type,
        icon: SHIFT_ICONS[type],
        label: SHIFT_LABELS[type]
    }));

    shiftTypes.forEach(st => {
        const item = document.createElement('div');
        item.className = 'context-menu-item';

        const isCurrent = currentShift === st.type;
        const isCurrentLocked = isCurrent && isLocked;

        // Show icon + label, with checkmark for current selection
        item.innerHTML = `${st.icon} ${st.label}${isCurrent ? ' ✓' : ''}`;

        // Visual feedback: red for locked, blue for current
        if (isCurrentLocked) {
            item.style.backgroundColor = '#fee2e2';  // Red for locked
        } else if (isCurrent) {
            item.style.backgroundColor = '#e0f2fe';  // Blue for current
        }

        item.onclick = () => {
            // Set shift
            setShift(dateStr, memberId, st.type);

            // If already locked, update the fixed value too
            if (isLocked) {
                if (!state.fixed[dateStr]) state.fixed[dateStr] = {};
                state.fixed[dateStr][memberId] = st.type;
            }
            // Do not create new lock (right click required)

            saveState();
            render();
            menu.remove();
        };

        menu.appendChild(item);
    });

    // Add back button only if navigated from parent menu
    if (parentMenu) {
        const backItem = document.createElement('div');
        backItem.className = 'context-menu-item context-menu-item-all';
        backItem.innerHTML = '← 戻る';
        backItem.onclick = () => {
            menu.remove();
            showContextMenu(e, dateStr);
        };
        menu.appendChild(backItem);
    }

    document.body.appendChild(menu);

    // Close menu when clicking outside
    const closeMenu = (event) => {
        if (!menu.contains(event.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
}

// --- Rendering ---
function render() {
    if (typeof viewMode !== 'undefined') {
        renderView();
    } else {
        renderSidebar();
        renderCalendar();
        updateStats();
    }
}

function renderSidebar() {
    els.memberList.innerHTML = '';

    // --- Members Section ---
    state.members.forEach(m => {
        const div = document.createElement('div');
        div.className = `member-item ${uiState.focusedMemberId === m.id ? 'focused' : ''}`;
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.justifyContent = 'space-between';
        div.style.gap = '8px';
        div.style.padding = '8px';
        div.style.marginBottom = '4px';
        div.style.backgroundColor = 'white';
        div.style.borderRadius = '6px';
        div.style.border = '1px solid var(--border)';
        div.style.cursor = 'pointer';

        // Toggle Focus on click
        div.onclick = (e) => {
            // Ignore if clicking interactive elements
            if (e.target.tagName === 'INPUT' || e.target.closest('button')) return;
            uiState.focusedMemberId = (uiState.focusedMemberId === m.id) ? null : m.id;
            render();
        };

        div.innerHTML = `
            <div style="flex:1; font-weight:500;">${m.name}</div>
            <div style="display:flex; align-items:center; gap:4px;">
                <span style="font-size:0.7rem; color:var(--text-muted);">追加休:</span>
                <input type="number" value="${m.extraOff}" min="0" style="width:40px; padding:2px; font-size:0.8rem; border:1px solid var(--border); border-radius:4px;"
                    onchange="updateMember('${m.id}', 'extraOff', this.value)" onClick="event.stopPropagation()">
                <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation(); deleteMember('${m.id}')" style="padding:4px; color:#ef4444;">
                    <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
                </button>
            </div>
        `;
        els.memberList.appendChild(div);
    });

    // Helper for updating member
    if (!window.updateMember) {
        window.updateMember = function (id, key, val) {
            const m = state.members.find(x => x.id === id);
            if (m) {
                m[key] = parseInt(val) || 0;
                saveState();
            }
        };
    }

    // --- Settings Section (Base Off) ---
    const settingsDiv = document.createElement('div');
    settingsDiv.className = 'sidebar-section';
    settingsDiv.style.marginTop = '16px';
    settingsDiv.innerHTML = `
        <div class="section-header">
            <h2>設定</h2>
        </div>
        <div class="settings-form">
            <div class="control-group">
                <label>月間休日数:</label>
                <input type="number" id="inp-base-off" value="${state.settings.baseOff}" min="0" max="31" style="width: 60px; padding: 4px;">
            </div>
            <div class="control-group">
                <label>連続勤務制限:</label>
                <input type="number" id="inp-max-consecutive" value="${state.settings.maxConsecutive || 5}" min="2" max="10" style="width: 60px; padding: 4px;">
            </div>
        </div>
        <hr style="border: 0; border-top: 1px solid var(--border); margin: 8px 0;">
    `;
    els.memberList.appendChild(settingsDiv);

    // Handler for Base Off & Max Consecutive
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
        const inpOff = document.getElementById('inp-base-off');
        if (inpOff) {
            inpOff.onchange = (e) => updateSetting('baseOff', parseInt(e.target.value) || 0);
        }
        const inpCons = document.getElementById('inp-max-consecutive');
        if (inpCons) {
            inpCons.onchange = (e) => updateSetting('maxConsecutive', parseInt(e.target.value) || 5);
        }
    });

    // --- Conditions Section ---
    const conditionsDiv = document.createElement('div');
    conditionsDiv.className = 'sidebar-section';
    conditionsDiv.innerHTML = `
        <div class="section-header">
            <h2>条件</h2>
            <button class="btn btn-sm btn-outline icon-only" onclick="addCondition()">
                <i data-lucide="plus" style="width:14px; height:14px;"></i>
            </button>
        </div>
        <div id="condition-list" style="display:flex; flex-direction:column; gap:8px;"></div>
        <hr style="border: 0; border-top: 1px solid var(--border); margin: 8px 0;">
    `;
    els.memberList.appendChild(conditionsDiv);

    const condList = document.getElementById('condition-list');
    state.conditions.forEach((c, idx) => {
        const row = document.createElement('div');
        row.className = 'condition-item';
        row.style.display = 'flex';
        row.style.gap = '4px';
        row.style.alignItems = 'center';
        row.style.fontSize = '0.8rem';

        row.innerHTML = `
            <select onchange="updateCondition(${idx}, 'type', this.value)" style="width:60px; font-size:0.75rem;">
                <option value="TOGETHER" ${c.type === 'TOGETHER' ? 'selected' : ''}>一緒</option>
                <option value="SEPARATE" ${c.type === 'SEPARATE' ? 'selected' : ''}>別々</option>
            </select>
            <select onchange="updateCondition(${idx}, 'm1', this.value)" style="width:70px; font-size:0.75rem;">
                <option value="">-</option>
                ${state.members.map(m => `<option value="${m.id}" ${m.id === c.m1 ? 'selected' : ''}>${m.name}</option>`).join('')}
            </select>
            <select onchange="updateCondition(${idx}, 'm2', this.value)" style="width:70px; font-size:0.75rem;">
                <option value="">-</option>
                ${state.members.map(m => `<option value="${m.id}" ${m.id === c.m2 ? 'selected' : ''}>${m.name}</option>`).join('')}
            </select>
            <button class="btn btn-sm btn-ghost" onclick="deleteCondition(${idx})" style="padding:2px;">
                <i data-lucide="x" style="width:12px;"></i>
            </button>
        `;
        condList.appendChild(row);
    });
    lucide.createIcons();
}

function renderCalendar() {
    els.calendarGrid.innerHTML = '';
    const dates = getDaysInMonth(state.settings.yearMonth);

    // Padding for start of month
    // Padding for start of month
    let firstDay = dates[0].getDay(); // 0(Sun)..6(Sat)
    // Convert to Monday-start: Mon=0...Sun=6
    firstDay = (firstDay === 0) ? 6 : firstDay - 1;

    for (let i = 0; i < firstDay; i++) {
        const pad = document.createElement('div');
        pad.className = 'cal-cell empty';
        els.calendarGrid.appendChild(pad);
    }

    dates.forEach(d => {
        const dateStr = formatDate(d);
        const cell = document.createElement('div');
        cell.className = 'cal-cell';

        // Interaction: Left Click -> Select Member/Shift, Right Click -> Toggle Day Lock
        cell.onclick = (e) => showContextMenu(e, dateStr);
        cell.oncontextmenu = (e) => {
            e.preventDefault();
            toggleDayLock(dateStr);
        };

        if (!isWorkDay(d)) {
            cell.style.backgroundColor = '#f8fafc'; // slightly gray for non-work
        }

        // Header (Date + Count)
        const dayHeader = document.createElement('div');
        dayHeader.className = 'cal-cell-header';

        // Add interaction
        dayHeader.onclick = (e) => { e.stopPropagation(); handleHeaderClick(dateStr); };
        dayHeader.oncontextmenu = (e) => { e.stopPropagation(); handleHeaderRightClick(e, dateStr); };
        dayHeader.title = "左クリック:人数指定 / 右クリック:メモ追加";
        dayHeader.style.cursor = 'pointer';

        const isToday = formatDate(new Date()) === dateStr;
        const weekDay = DAYS_JP[d.getDay()];

        // Note
        const note = state.dailyNotes && state.dailyNotes[dateStr];
        // Target
        const target = state.dailyTargets && state.dailyTargets[dateStr];

        dayHeader.innerHTML = `
            <div style="display:flex; flex-direction:column; width:100%;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span class="cal-date ${isToday ? 'today' : ''}">
                        ${d.getDate()} <small>(${weekDay})</small>
                    </span>
                    ${target ? `<span style="font-size:0.7rem; background:#e0f2fe; color:#0369a1; padding:1px 3px; border-radius:3px;">求:${target}</span>` : ''}
                </div>
                ${note ? `<div style="font-size:0.75rem; color:#d97706; font-weight:bold;">${note}</div>` : ''}
            </div>
            `;

        // Count On-Site
        const onSiteCount = countOnSite(dateStr);
        if (onSiteCount > 0) {
            const countBadge = document.createElement('span');
            countBadge.className = 'cal-count';
            countBadge.textContent = onSiteCount;
            // Warning if target mismatch
            if (target && onSiteCount !== parseInt(target)) {
                countBadge.style.background = '#ef4444';
                countBadge.style.color = 'white';
            }
            dayHeader.appendChild(countBadge);
        }

        cell.appendChild(dayHeader);

        // Content Area (Shift Chips)
        const contentDiv = document.createElement('div');
        contentDiv.className = 'cal-cell-content';

        // Render shifts for this date
        state.members.forEach(m => {
            const shift = getShift(dateStr, m.id);
            if (!shift || shift === 'OFF') return; // Skip OFF or empty

            // Skip if focus mode and not focused member
            if (uiState.focusedMemberId && uiState.focusedMemberId !== m.id) return;

            const chip = document.createElement('div');
            chip.className = `shift-chip type-${shift.toLowerCase().replace('_', '-')}`;
            chip.draggable = true;
            // Display first 3 characters of name
            chip.textContent = m.name.substring(0, 3);

            if (isFixed(dateStr, m.id)) {
                chip.classList.add('locked');
            }

            // Events
            chip.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                showShiftTypeSelector(e, dateStr, m.id);
            };
            chip.oncontextmenu = (e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleLock(dateStr, m.id);
            };
            chip.ondragstart = (e) => handleDragStart(e, m.id, dateStr);
            chip.ondragend = () => chip.classList.remove('is-dragging');

            contentDiv.appendChild(chip);
        });

        // Right-click on empty area: Show context menu to lock OFF for any member
        cell.addEventListener('contextmenu', (e) => {
            // Only if clicking on the cell itself, not on a chip
            if (e.target === cell || e.target === contentDiv) {
                e.preventDefault();
                showContextMenu(e, dateStr);
            }
        });

        // Drag & Drop
        cell.ondragover = (e) => {
            e.preventDefault();
            cell.classList.add('drag-over');
        };
        cell.ondragleave = () => cell.classList.remove('drag-over');
        cell.ondrop = (e) => handleDrop(e, dateStr);

        cell.appendChild(contentDiv);
        els.calendarGrid.appendChild(cell);
    });
}

function renderTimeline() {
    const container = document.getElementById('timeline-container');
    if (!container) return;

    const dates = getDaysInMonth(state.settings.yearMonth);

    let html = `
        <div class="timeline-wrapper">
            <table class="timeline-table">
                <thead>
                    <tr>
                        <th class="timeline-member-cell header">メンバー</th>
    `;

    // Header: Dates
    dates.forEach(d => {
        const dateStr = formatDate(d);
        const dayNum = d.getDate();
        const dayWeek = DAYS_JP[d.getDay()];
        const isToday = formatDate(new Date()) === dateStr;
        const isSat = d.getDay() === 6;
        const isSun = d.getDay() === 0;

        const note = state.dailyNotes && state.dailyNotes[dateStr];
        const target = state.dailyTargets && state.dailyTargets[dateStr];

        let cellClass = 'timeline-header-cell';
        if (isSat) cellClass += ' sat';
        if (isSun) cellClass += ' sun';
        if (isToday) cellClass += ' today';

        html += `
            <th class="${cellClass}" 
                onclick="handleHeaderClick('${dateStr}')" 
                oncontextmenu="handleHeaderRightClick(event, '${dateStr}')"
                title="左クリック:人数指定 / 右クリック:メモ追加">
                <div style="display:flex; flex-direction:column; justify-content:space-between; height:100%;">
                    <div>
                        <div class="day-num">${dayNum}</div>
                        <div class="day-week">${dayWeek}</div>
                    </div>
                    <div>
                        ${note ? '<div class="marker note"></div>' : ''}
                        ${target ? '<div class="marker target"></div>' : ''}
                    </div>
                </div>
            </th>
        `;
    });

    html += `
                    </tr >
                </thead >
                <tbody>
    `;

    // Rows: Members
    state.members.forEach(m => {
        const isFocused = uiState.focusedMemberId === m.id;
        const isDimmed = uiState.focusedMemberId && uiState.focusedMemberId !== m.id;

        let rowClass = 'timeline-row';
        if (isFocused) rowClass += ' focused';
        if (isDimmed) rowClass += ' dimmed';

        html += `<tr class="${rowClass}">`;

        // Member Name Cell
        html += `<td class="timeline-member-cell">
            <div class="member-info">
                <div class="member-name">${m.name}</div>
                ${m.extraOff > 0 ? `<div style="font-size:0.65rem; color:#ef4444;">+休: ${m.extraOff}</div>` : ''}
            </div>
        </td>`;

        dates.forEach(d => {
            const dateStr = formatDate(d);
            const shift = getShift(dateStr, m.id);
            const locked = isFixed(dateStr, m.id);
            const workDay = isWorkDay(d);

            let cellClass = 'timeline-cell';
            if (!workDay) cellClass += ' non-work';
            if (locked) cellClass += ' locked-cell';

            // Add right-click to entire cell
            html += `<td class="${cellClass}" 
                         onclick="showShiftTypeSelector(event, '${dateStr}', '${m.id}')"
                         oncontextmenu="toggleLock('${dateStr}', '${m.id}'); return false;">`;

            if (shift && shift !== 'OFF') {
                // Use centralized icon constants
                const icon = SHIFT_ICONS[shift] || '';
                const typeClass = `type-${shift.toLowerCase().replace('_', '-')}`;

                html += `
                    <div class="timeline-chip ${typeClass} ${locked ? 'locked' : ''}"
                         draggable="true"
                         title="${SHIFT_LABELS[shift]}"
                         onclick="event.stopPropagation(); showShiftTypeSelector(event, '${dateStr}', '${m.id}')"
                         oncontextmenu="event.stopPropagation(); toggleLock('${dateStr}', '${m.id}'); return false;"
                         ondragstart="handleDragStart(event, '${m.id}', '${dateStr}')" 
                         ondragend="this.classList.remove('is-dragging')">
                        ${icon}
                    </div>
                `;
            } else {
                // Empty or OFF - show icon if locked
                if (locked && shift === 'OFF') {
                    html += `
                        <div class="timeline-chip type-off locked"
                             onclick="event.stopPropagation(); showShiftTypeSelector(event, '${dateStr}', '${m.id}')"
                             oncontextmenu="event.stopPropagation(); toggleLock('${dateStr}', '${m.id}'); return false;">
                            ${SHIFT_ICONS.OFF}
                        </div>
                    `;
                }
                // Empty cell - no chip needed, cell itself is clickable
            }

            html += `</td>`;
        });

        // Add row statistics
        let workDays = 0;
        let daysOff = 0;
        let lockedCount = 0;

        dates.forEach(d => {
            const dateStr = formatDate(d);
            const shift = getShift(dateStr, m.id);
            const locked = isFixed(dateStr, m.id);

            workDays += getShiftDays(shift);
            if (shift === 'OFF' || !shift) daysOff++;
            if (locked) lockedCount++;
        });

        html += `
            <td class="timeline-stats-cell">
                <div class="row-stats">
                    <div class="stat-badge">
                        <span class="stat-badge-label">出勤</span>
                        <span class="stat-badge-value" style="color:var(--primary);">${workDays}</span>
                    </div>
                    <div class="stat-badge">
                        <span class="stat-badge-label">休日</span>
                        <span class="stat-badge-value" style="color:var(--text-muted);">${daysOff}</span>
                    </div>
                    ${lockedCount > 0 ? `
                    <div class="stat-badge warn">
                        <span class="stat-badge-label">固定</span>
                        <span class="stat-badge-value" style="color:#ef4444;">${lockedCount}</span>
                    </div>` : ''}
                </div>
            </td>
        `;

        html += `</tr>`;
    });

    html += `
                </tbody>
                <tfoot>
    `;

    // --- Footer: Multi-row Stats ---

    // Row 1: On-Site Count
    html += `<tr><td class="timeline-footer-label">出勤人数</td>`;
    dates.forEach(d => {
        const dateStr = formatDate(d);
        const onSiteCount = countOnSite(dateStr);
        const target = state.dailyTargets && state.dailyTargets[dateStr];

        let styleClass = 'timeline-footer-cell';
        if (target && onSiteCount !== parseInt(target)) styleClass += ' warn';

        html += `<td class="${styleClass}">${onSiteCount}</td>`;
    });
    html += `<td class="timeline-footer-cell"></td></tr>`;

    // Row 2: Off/Other Count (Total - OnSite)
    html += `<tr><td class="timeline-footer-label">休日/他</td>`;
    dates.forEach(d => {
        const dateStr = formatDate(d);
        const onSiteCount = countOnSite(dateStr);
        const total = state.members.length;
        const offCount = total - onSiteCount;

        html += `<td class="timeline-footer-cell" style="color:#64748b;">${offCount}</td>`;
    });
    html += `<td class="timeline-footer-cell"></td></tr>`;

    // Row 3: Variance from Target (only if target exists)
    // Check if any target exists to decide if we show this row
    const hasTargets = Object.keys(state.dailyTargets || {}).length > 0;

    if (hasTargets) {
        html += `<tr><td class="timeline-footer-label">目標差分</td>`;
        dates.forEach(d => {
            const dateStr = formatDate(d);
            const onSiteCount = countOnSite(dateStr);
            const target = state.dailyTargets && state.dailyTargets[dateStr];

            if (target) {
                const diff = onSiteCount - parseInt(target);
                let content = diff > 0 ? `+${diff}` : `${diff}`;
                if (diff === 0) content = "OK";

                let color = diff === 0 ? '#10b981' : (diff > 0 ? '#3b82f6' : '#ef4444');
                html += `<td class="timeline-footer-cell" style="color:${color}; font-weight:bold;">${content}</td>`;
            } else {
                html += `<td class="timeline-footer-cell">-</td>`;
            }
        });
        html += `<td class="timeline-footer-cell"></td></tr>`;
    }

    html += `
                </tfoot >
            </table >
        </div >
            `;

    container.innerHTML = html;
}



function countOnSite(dateStr) {
    if (!state.shifts[dateStr]) return 0;
    return Object.values(state.shifts[dateStr]).filter(s => s === 'ON_SITE').length;
}

function updateStats() {
    const dates = getDaysInMonth(state.settings.yearMonth);
    const workDays = dates.filter(isWorkDay).length;
    els.statWorkDays.textContent = `${workDays} 日`;

    let totalAssigned = 0;
    const activeMemberCount = state.members.length;

    // Scan all shifts
    Object.values(state.shifts).forEach(dayMap => {
        Object.values(dayMap).forEach(status => {
            if (status === 'ON_SITE' || status === 'TRIP') {
                totalAssigned++;
            }
        });
    });

    // Average
    const avg = activeMemberCount > 0 ? (totalAssigned / activeMemberCount).toFixed(1) : 0;

    els.statTotalSlots.innerHTML = `${totalAssigned} <small>(平均 ${avg}日)</small>`;
}


// --- Drag & Drop ---
let dragSource = null; // { memberId, fromDate }

function handleDragStart(e, memberId, fromDate) {
    dragSource = { memberId, fromDate };
    e.dataTransfer.effectAllowed = 'copyMove';
    e.dataTransfer.setData('text/plain', JSON.stringify({ memberId, fromDate }));
    setTimeout(() => e.target.classList.add('is-dragging'), 0);
}

// Drag from sidebar
function handleSidebarDragStart(e, memberId) {
    dragSource = { memberId, fromDate: null };
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', JSON.stringify({ memberId, fromDate: null }));
}

function handleDrop(e, toDate) {
    e.preventDefault();
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));

    if (!dragSource) return;
    const { memberId, fromDate } = dragSource;

    // Check if destination is locked
    if (state.fixed[toDate] && state.fixed[toDate][memberId]) {
        alert("移動先が固定されています");
        dragSource = null;
        return;
    }

    let status = 'ON_SITE';
    if (fromDate) {
        status = state.shifts[fromDate][memberId] || 'ON_SITE';
        if (state.fixed[fromDate] && state.fixed[fromDate][memberId]) {
            alert("移動元が固定されています");
            dragSource = null;
            return;
        }
        delete state.shifts[fromDate][memberId];

        if (fromDate === toDate) {
            setShift(toDate, memberId, status); // put back
            render(); dragSource = null; return;
        }
    }

    setShift(toDate, memberId, status);

    render();
    saveState();
    dragSource = null;
}


// --- Storage ---
function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);

            // Migration: Convert legacy workDays format if needed
            if (parsed.settings && parsed.settings.workDays) {
                const wd = parsed.settings.workDays;
                // Check if 'mon' key is missing (indicates old format)
                if (typeof wd.mon === 'undefined') {
                    const newWD = {
                        mon: 'WORK', tue: 'WORK', wed: 'WORK', thu: 'WORK', fri: 'WORK',
                        // Convert boolean to WORK/OFF string
                        sat: wd.sat === true ? 'WORK' : 'OFF',
                        sun: wd.sun === true ? 'WORK' : 'OFF'
                    };
                    parsed.settings.workDays = newWD;
                }
            }

            state = { ...state, ...parsed };

            // Final safety check
            if (!state.settings.workDays) {
                state.settings.workDays = {
                    mon: 'WORK', tue: 'WORK', wed: 'WORK', thu: 'WORK', fri: 'WORK',
                    sat: 'OFF', sun: 'OFF'
                };
            }
        } catch (e) { console.error("Load failed", e); }
    }
}

// --- Export / Import ---
// --- Export / Import ---
function exportData() {
    // Add version to export
    const exportData = {
        version: 1,
        ...state
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `shunkin_${state.settings.yearMonth}.json`);
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const parsed = JSON.parse(e.target.result);
            // Basic validation
            if (!parsed.members || !parsed.settings) {
                alert("無効なファイル形式です");
                return;
            }
            // Remove version key if present before setting state
            const { version, ...cleanData } = parsed;

            state = cleanData;
            saveState();
            render();
            // Update inputs
            updateUIInputs();
            alert("インポートしました");
        } catch (err) {
            console.error(err);
            alert("読み込みに失敗しました");
        }
    };
    reader.readAsText(file);
    // Reset input
    event.target.value = '';
}

// Hook up events
els.btnExport.addEventListener('click', exportData);
els.btnImport.addEventListener('click', () => els.fileImport.click());
els.fileImport.addEventListener('change', importData);

// --- View Mode ---
let viewMode = 'calendar'; // 'calendar' | 'timeline'
const uiState = { focusedMemberId: null };

els.btnViewCal = document.getElementById('btn-view-cal');
els.btnViewTimeline = document.getElementById('btn-view-timeline');

window.setViewMode = function (mode) {
    viewMode = mode;
    els.btnViewCal.classList.toggle('btn-primary', mode === 'calendar');
    els.btnViewCal.classList.toggle('btn-secondary', mode !== 'calendar');
    els.btnViewTimeline.classList.toggle('btn-primary', mode === 'timeline');
    els.btnViewTimeline.classList.toggle('btn-secondary', mode !== 'timeline');
    render();
};

els.btnViewCal.addEventListener('click', () => setViewMode('calendar'));
els.btnViewTimeline.addEventListener('click', () => setViewMode('timeline'));

// --- Rendering ---
function renderView() {
    renderSidebar();

    const calArea = document.querySelector('.calendar-area');
    const tlContainer = document.getElementById('timeline-container');

    if (viewMode === 'calendar') {
        if (calArea) calArea.style.display = 'flex';
        if (tlContainer) tlContainer.style.display = 'none';
        renderCalendar();
    } else {
        if (calArea) calArea.style.display = 'none';
        if (tlContainer) tlContainer.style.display = 'flex';
        renderTimeline();
    }
    updateStats();
}
// Timeline Drop Handler (for member reassignment in timeline view)
function handleTimelineDrop(e, toDate, toMemberId) {
    e.preventDefault();
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));

    if (!dragSource) return;
    const { memberId: srcMemberId, fromDate } = dragSource;

    const destMemberId = toMemberId;

    // Validations
    if (state.fixed[toDate] && state.fixed[toDate][destMemberId]) {
        alert("移動先が固定されています");
        dragSource = null;
        return;
    }

    let status = 'ON_SITE';
    if (fromDate) {
        status = state.shifts[fromDate][srcMemberId] || 'ON_SITE';

        if (state.fixed[fromDate] && state.fixed[fromDate][srcMemberId]) {
            alert("移動元が固定されています");
            dragSource = null;
            return;
        }

        delete state.shifts[fromDate][srcMemberId];
    }

    setShift(toDate, destMemberId, status);
    render();
    saveState();
    dragSource = null;
}
window.handleTimelineDrop = handleTimelineDrop;


// Start
init();
// Default mode
setViewMode('calendar');

