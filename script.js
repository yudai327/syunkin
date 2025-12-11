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
    HALF_AM: 'AM半休',
    HALF_PM: 'PM半休',
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
    // Conditions: [{ type: 'TOGETHER'|'SEPARATE', m1: id, m2: id }]
    conditions: [],
    // Last Holiday Date for each member per month: "YYYY-MM" -> { memberId: "YYYY-MM-DD" }
    lastHolidays: {}
};

// --- DOM Elements ---
const els = {
    monthInput: document.getElementById('month-picker'),
    btnPrevMonth: document.getElementById('btn-prev-month'),
    btnNextMonth: document.getElementById('btn-next-month'),
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
    // Sidebar Settings
    settingBaseOff: document.getElementById('setting-base-off'),
    settingMaxConsecutive: document.getElementById('setting-max-consecutive'),

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

    // Sidebar Settings
    if (els.settingBaseOff) els.settingBaseOff.value = state.settings.baseOff || 8;
    if (els.settingMaxConsecutive) els.settingMaxConsecutive.value = state.settings.maxConsecutive || 5;

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

    // Month Navigation
    if (els.btnPrevMonth) els.btnPrevMonth.addEventListener('click', () => changeMonth(-1));
    if (els.btnNextMonth) els.btnNextMonth.addEventListener('click', () => changeMonth(1));

    // Weekday settings events
    const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    days.forEach(day => {
        const key = 'day' + day.charAt(0).toUpperCase() + day.slice(1);
        if (els[key]) {
            els[key].addEventListener('change', (e) => updateWorkDay(day, e.target.value));
        }
    });

    // Sidebar Settings Events
    if (els.settingBaseOff) {
        els.settingBaseOff.addEventListener('change', (e) => updateSetting('baseOff', parseInt(e.target.value)));
    }
    if (els.settingMaxConsecutive) {
        els.settingMaxConsecutive.addEventListener('change', (e) => updateSetting('maxConsecutive', parseInt(e.target.value)));
    }

    els.btnGenerate.addEventListener('click', generateSchedule);
    els.btnReset.addEventListener('click', resetSchedule);
    els.btnPrint.addEventListener('click', () => {
        preparePrint();
        window.print();
    });
    els.btnAddMember.addEventListener('click', addMember);

    // Help Modal
    initHelpModal();

    render();
}

function initHelpModal() {
    const modal = document.getElementById('help-modal');
    const btnHelp = document.getElementById('btn-help');
    const btnClose = document.getElementById('btn-close-help');
    const btnCloseMain = document.getElementById('btn-close-help-main');

    if (!modal) return;

    function showHelp() {
        modal.style.display = 'flex';
    }

    function hideHelp() {
        modal.style.display = 'none';
        localStorage.setItem('shunkin_help_shown_v1', 'true');
    }

    // Event Listeners
    if (btnHelp) btnHelp.addEventListener('click', showHelp);
    if (btnClose) btnClose.addEventListener('click', hideHelp);
    if (btnCloseMain) btnCloseMain.addEventListener('click', hideHelp);

    // Close on click outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) hideHelp();
    });

    // Auto-show on first visit
    const shown = localStorage.getItem('shunkin_help_shown_v1');
    if (!shown) {
        showHelp();
    }
}

// --- Print Logic ---
function preparePrint() {
    const printArea = document.getElementById('print-area');
    if (!printArea) return;
    printArea.innerHTML = ''; // Clear

    const ym = state.settings.yearMonth;

    // 1. Title
    const header = document.createElement('div');
    header.className = 'print-header';
    header.innerHTML = `<h1>${ym} シフト表</h1>`;
    printArea.appendChild(header);

    // 2. Table
    const table = document.createElement('table');
    table.className = 'print-calendar';

    // Header Row
    const thead = document.createElement('thead');
    const trHead = document.createElement('tr');
    DAYS_JP.forEach(d => {
        const th = document.createElement('th');
        th.textContent = d;
        trHead.appendChild(th);
    });
    thead.appendChild(trHead);
    table.appendChild(thead);

    // Body
    const tbody = document.createElement('tbody');
    const dates = getDaysInMonth(ym);
    let firstDay = dates[0].getDay();

    let tr = document.createElement('tr');
    // Pad start
    for (let i = 0; i < firstDay; i++) {
        const td = document.createElement('td');
        tr.appendChild(td);
    }

    dates.forEach(d => {
        if (d.getDay() === 0 && tr.children.length > 0) {
            tbody.appendChild(tr);
            tr = document.createElement('tr');
        }

        const td = document.createElement('td');
        const dateStr = formatDate(d);

        // Date Label
        const dateDiv = document.createElement('span');
        dateDiv.className = 'print-date';
        dateDiv.textContent = d.getDate();
        td.appendChild(dateDiv);

        // Target & Note (Calendar)
        const target = state.dailyTargets && state.dailyTargets[dateStr];
        const note = state.dailyNotes && state.dailyNotes[dateStr];

        if (target || note) {
            const infoDiv = document.createElement('div');
            infoDiv.style.fontSize = '0.6rem';
            infoDiv.style.marginBottom = '2px';
            infoDiv.style.color = '#555';

            if (target) {
                const tSpan = document.createElement('span');
                tSpan.textContent = `必要: ${target} `;
                tSpan.style.marginRight = '4px';
                infoDiv.appendChild(tSpan);
            }
            if (note) {
                const nSpan = document.createElement('span');
                nSpan.textContent = note;
                nSpan.style.fontWeight = 'bold';
                infoDiv.appendChild(nSpan);
            }
            td.appendChild(infoDiv);
        }

        // Shifts Container (Grid)
        const gridDiv = document.createElement('div');
        gridDiv.className = 'print-cell-content';

        state.members.forEach(m => {
            const shift = getShift(dateStr, m.id);
            if (shift && shift !== 'OFF') {
                const shiftDiv = document.createElement('div');
                shiftDiv.className = 'print-shift-item';

                // Abbreviated Shift Names
                const abbrev = {
                    'ON_SITE': '出',
                    'HALF_AM': 'AM',
                    'HALF_PM': 'PM',
                    'TRIP': '張',
                    'OFF': '休'
                }[shift] || shift;

                // Truncate name to 3 chars for Calendar
                const shortName = m.name.slice(0, 3);
                shiftDiv.textContent = `${shortName}:${abbrev}`;
                gridDiv.appendChild(shiftDiv);
            }
        });
        td.appendChild(gridDiv);

        tr.appendChild(td);
    });

    // Fill last row padding
    if (tr.children.length > 0) {
        while (tr.children.length < 7) {
            const td = document.createElement('td');
            tr.appendChild(td);
        }
        tbody.appendChild(tr);
    }

    table.appendChild(tbody);
    printArea.appendChild(table);

    // --- Part 2: Timeline View ---
    const timelineSection = document.createElement('div');
    timelineSection.className = 'print-timeline-section';
    timelineSection.innerHTML = `<h1>${ym} シフト表 (タイムライン)</h1>`;
    printArea.appendChild(timelineSection);

    const tlTable = document.createElement('table');
    tlTable.className = 'print-timeline';

    // Header
    const tlThead = document.createElement('thead');
    const tlTrHead = document.createElement('tr');

    // Member Name Column
    const thName = document.createElement('th');
    thName.className = 'member-col';
    thName.textContent = '氏名';
    tlTrHead.appendChild(thName);

    // Date Columns
    dates.forEach(d => {
        const th = document.createElement('th');
        // Show Day Number <br> (Weekday)
        const dayName = DAYS_JP[d.getDay()];
        th.innerHTML = `${d.getDate()}<br><span style="font-size:0.55rem">(${dayName})</span>`;
        th.style.fontSize = '0.6rem';
        th.style.lineHeight = '1.1';

        // Color for Sat/Sun
        if (d.getDay() === 0) th.style.color = '#ef4444'; // Red Sun
        if (d.getDay() === 6) th.style.color = '#3b82f6'; // Blue Sat
        tlTrHead.appendChild(th);
    });

    // Summary Header
    const thSum = document.createElement('th');
    thSum.className = 'summary-col';
    thSum.textContent = '出勤';
    tlTrHead.appendChild(thSum);

    tlThead.appendChild(tlTrHead);
    tlTable.appendChild(tlThead);

    // Body
    const tlTbody = document.createElement('tbody');

    // Per-Day Counts for Footer
    const dailyCounts = new Array(dates.length).fill(0);

    state.members.forEach(m => {
        const tr = document.createElement('tr');

        // Name Cell
        const tdName = document.createElement('td');
        tdName.style.textAlign = 'left';
        tdName.style.paddingLeft = '4px';
        // Truncate name to 6 chars for Timeline
        tdName.textContent = m.name.slice(0, 6);
        tr.appendChild(tdName);

        let memberWorkCount = 0;

        // Date Cells
        dates.forEach((d, idx) => {
            const td = document.createElement('td');
            td.className = 'shift-cell';
            const dateStr = formatDate(d);
            const shift = getShift(dateStr, m.id);

            if (shift && shift !== 'OFF') {
                // Use icon for compact view
                td.textContent = SHIFT_ICONS[shift] || shift;
                memberWorkCount += getShiftDays(shift); // Using existing helper
                dailyCounts[idx] += getShiftDays(shift);
            }
            tr.appendChild(td);
        });

        // Summary Cell
        const tdSum = document.createElement('td');
        tdSum.className = 'summary-col';
        tdSum.textContent = memberWorkCount;
        tr.appendChild(tdSum);

        tlTbody.appendChild(tr);
    });

    // Footer Row (Daily Totals)
    const trFooter = document.createElement('tr');
    trFooter.className = 'summary-row';

    const tdFooterLabel = document.createElement('td');
    tdFooterLabel.textContent = '計';
    trFooter.appendChild(tdFooterLabel);

    dailyCounts.forEach(count => {
        const td = document.createElement('td');
        td.textContent = count > 0 ? count : '';
        trFooter.appendChild(td);
    });

    // Grand Total (bottom right) - optional, or empty
    const tdGrandTotal = document.createElement('td');
    tdGrandTotal.className = 'summary-col';
    // Sum of all work days?
    const totalManDays = dailyCounts.reduce((a, b) => a + b, 0);
    tdGrandTotal.textContent = totalManDays;
    trFooter.appendChild(tdGrandTotal);

    tlTbody.appendChild(trFooter);

    // Footer Row (Targets)
    const trTarget = document.createElement('tr');
    trTarget.className = 'summary-row';
    trTarget.style.backgroundColor = '#fffbeb'; // Light yellow for targets

    const tdTargetLabel = document.createElement('td');
    tdTargetLabel.textContent = '必要';
    trTarget.appendChild(tdTargetLabel);

    dates.forEach(d => {
        const dateStr = formatDate(d);
        const target = state.dailyTargets && state.dailyTargets[dateStr];
        const td = document.createElement('td');
        if (target) {
            td.textContent = target;
            td.style.color = '#d97706';
        }
        trTarget.appendChild(td);
    });

    // Empty cell under total
    trTarget.appendChild(document.createElement('td'));
    tlTbody.appendChild(trTarget);

    tlTable.appendChild(tlTbody);
    printArea.appendChild(tlTable);

    // --- Remarks (Notes) ---
    const remarksDiv = document.createElement('div');
    remarksDiv.style.marginTop = '10px';
    remarksDiv.style.fontSize = '0.7rem';

    const notesList = [];
    dates.forEach(d => {
        const dateStr = formatDate(d);
        const note = state.dailyNotes && state.dailyNotes[dateStr];
        if (note) {
            notesList.push(`・${d.getDate()}日: ${note}`);
        }
    });

    if (notesList.length > 0) {
        remarksDiv.innerHTML = `<strong>【備考・行事】</strong><br>${notesList.join('<br>')}`;
        printArea.appendChild(remarksDiv);
    }
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
    const input = prompt(`${dateStr}\n必要人数を入力してください (空欄で解除):`, current);
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

function changeMonth(diff) {
    const current = state.settings.yearMonth; // YYYY-MM
    const [y, m] = current.split('-').map(Number);
    const date = new Date(y, m - 1 + diff, 1); // Month is 0-indexed in Date

    const nextY = date.getFullYear();
    const nextM = ('0' + (date.getMonth() + 1)).slice(-2);
    const nextYM = `${nextY}-${nextM}`;

    // Force update the input directly to ensure UI reflects change immediately
    const input = document.getElementById('month-picker');
    if (input) input.value = nextYM;

    updateSetting('yearMonth', nextYM);
}

// --- Logic: Generator (Heuristic) ---
// --- Last Holiday Logic ---

function getPrevMonth(ym) {
    const [y, m] = ym.split('-').map(Number);
    let py = y;
    let pm = m - 1;
    if (pm === 0) {
        pm = 12;
        py--;
    }
    return `${py}-${('0' + pm).slice(-2)}`;
}

function getNextMonth(ym) {
    const [y, m] = ym.split('-').map(Number);
    let ny = y;
    let nm = m + 1;
    if (nm === 13) {
        nm = 1;
        ny++;
    }
    return `${ny}-${('0' + nm).slice(-2)}`;
}

function findLastHolidayInMonth(memberId, ym) {
    // Check if we have shift data for ym
    const distinctDates = getMatchMonthDates(ym);
    if (distinctDates.length === 0) return null;

    // Search backwards from end of month
    // Sort desc
    distinctDates.sort((a, b) => new Date(b) - new Date(a));

    for (const dateStr of distinctDates) {
        const shift = getShift(dateStr, memberId);
        const isWorking = (shift === 'ON_SITE' || shift === 'TRIP' || shift === 'HALF_AM' || shift === 'HALF_PM');
        if (!isWorking || shift === 'OFF') {
            return dateStr;
        }
    }
    return null;
}

function getDefaultLastHoliday(memberId) {
    const currentYM = state.settings.yearMonth;
    // If it's the very first time and we have NO stored yearMonth, default logic might fail.
    // But init guarantees state.settings.yearMonth
    const prevYM = getPrevMonth(currentYM);

    // 1. Try to find in previous month data
    const detected = findLastHolidayInMonth(memberId, prevYM);
    if (detected) return detected;

    // 2. Default to last day of previous month
    // Calculate last day of prevYM
    const [y, m] = prevYM.split('-').map(Number);
    const lastDay = new Date(y, m, 0); // Day 0 of next month is last day of this month (m is 1-based but Date() month is 0-based... wait)
    // Date(year, monthIndex, day)
    // prevYM = "2023-11" -> y=2023, m=11.
    // new Date(2023, 11, 0) -> "2023-11-30" (December 0th)
    return formatDate(lastDay);
}

function getLastHoliday(memberId) {
    const ym = state.settings.yearMonth;
    // Explicitly set value?
    if (state.lastHolidays && state.lastHolidays[ym] && state.lastHolidays[ym][memberId]) {
        return state.lastHolidays[ym][memberId];
    }
    // Otherwise return default
    return getDefaultLastHoliday(memberId);
}

function setLastHoliday(memberId, dateStr) {
    const ym = state.settings.yearMonth;
    if (!state.lastHolidays) state.lastHolidays = {};
    if (!state.lastHolidays[ym]) state.lastHolidays[ym] = {};

    if (dateStr) {
        state.lastHolidays[ym][memberId] = dateStr;
    } else {
        delete state.lastHolidays[ym][memberId];
    }
    saveState();
    // Re-render to show (potential) new default
    renderSidebar();
    showToast(`${dateStr ? '設定' : '自動(デフォルト)'}: 前月最終休日`, "success");
}

window.updateLastHoliday = function (memberId, val) {
    setLastHoliday(memberId, val);
}

window.autoDetectLastHoliday = function (memberId) {
    const currentYM = state.settings.yearMonth;
    const prevYM = getPrevMonth(currentYM);

    const foundDate = findLastHolidayInMonth(memberId, prevYM);

    if (foundDate) {
        setLastHoliday(memberId, foundDate);
    } else {
        showToast(`前月のデータから休日が見つかりませんでした`, "warning");
        // We do NOT set default here if failed, user can just leave it empty to use fallback default
    }
};

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

            // Only update if different? Or always overwrite ensures sync?
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
        showToast(`翌月(${nextYM})の[前月最終休日]を更新しました (${counted}名${example})`, "success");
    } else {
        console.log(`Checked next month (${nextYM}) update. No changes necessary or no holidays found.`);
    }
}

function getMatchMonthDates(ym) {
    // Helper to find all dates in state.shifts that start with YYYY-MM
    // This is for auto-detect when we might have partial data
    // Ideally we strictly generate days in month, but if we have holes, we check existing keys.
    // Better: generate all days in that month and check.
    const days = getDaysInMonth(ym);
    return days.map(d => formatDate(d));
}

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

        // 1. Initialize Shifts (Preserve other months)
        // We want to keep shifts that are NOT in the current month range.
        // But we DO want to reset shifts in the current month (unless fixed).

        // Clone existing shifts
        const newShifts = { ...state.shifts };

        // Clear current month's non-fixed shifts
        dates.forEach(d => {
            const dateStr = formatDate(d);

            // If we have fixed data, ensure it is set
            if (state.fixed[dateStr]) {
                if (!newShifts[dateStr]) newShifts[dateStr] = {};
                Object.keys(state.fixed[dateStr]).forEach(mId => {
                    newShifts[dateStr][mId] = state.fixed[dateStr][mId];
                });
            } else {
                // If it was just a normal generated day, maybe clear it?
                // But wait, the logic below (Step 2) iterates members and SETS shifts.
                // So simply ensuring newShifts[dateStr] exists is enough to start overwriting?
                // Actually, if we don't clear, old generated data might persist if logic doesn't overwrite everything.
                // But Step 2 iterates ALL members and ALL dates in month to set initial content.
                // It does: if (!isWorkDay) set OFF. Then later fills work days.
                // So it effectively overwrites.

                // However, to be safe and clean, let's reset the day object if it exists and isn't fixed.
                // But wait, fixed is granular per member. 
                // So we should keep the day object, but maybe clear non-fixed members?

                if (!newShifts[dateStr]) newShifts[dateStr] = {};
            }

            // Sync fixed data rigorously
            if (state.fixed[dateStr]) {
                if (!newShifts[dateStr]) newShifts[dateStr] = {};
                Object.assign(newShifts[dateStr], state.fixed[dateStr]);
            }

            // CRITICAL FIX: Clear non-fixed shifts for this date to ensure re-generation
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

            // Treat all available work days equally for initial assignment
            // Use Fisher-Yates shuffle for true uniform randomness
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
        // Goal: Minimize Variance of Daily Attendance + Penalty for Consecutive > N + Conditions

        // Pre-calculate Last Holidays to avoid repeated calls in loop
        const cachedLastHolidays = {};
        state.members.forEach(m => {
            cachedLastHolidays[m.id] = getLastHoliday(m.id);
        });

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
                // MODIFIED: Exclude HALF_AM/PM/OFF from variance calculation to match validation logic
                // We typically only want to flatten "Full Work" days.
                const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
                const dayKey = dayNames[d.getDay()];
                const setting = state.settings.workDays[dayKey];

                if (setting !== 'HALF_AM' && setting !== 'HALF_PM' && setting !== 'OFF') {
                    // Start of Variance Input
                    const hasTarget = state.dailyTargets && state.dailyTargets[dateStr] !== undefined && state.dailyTargets[dateStr] !== null && state.dailyTargets[dateStr] !== '';
                    if (!hasTarget) {
                        if (count < minCount) minCount = count;
                        if (count > maxCount) maxCount = count;
                    }
                }

                score += (count * count) * 10; // Smoothing weight
            });

            // Strict Variance Penalty (Max - Min must be < 2, i.e. 0 or 1)
            // INCREASED penalty per user request to force flatness
            if (maxCount !== -1 && (maxCount - minCount) >= 2) {
                const diff = maxCount - minCount;
                score += diff * 10000; // Aggressive scaled penalty (e.g. diff 2 -> +20000, diff 3 -> +30000)
            }

            // B. Consecutive Shifts (Penalty for > N)
            const limit = state.settings.maxConsecutive || 5;
            state.members.forEach(m => {
                let consecutive = 0;

                // Initialize consecutive based on last holiday
                const lh = cachedLastHolidays[m.id];
                if (lh) {
                    const startOfMonth = dates[0];
                    const lhDate = new Date(lh);
                    // Time difference in days
                    const diffTime = startOfMonth - lhDate;
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    // e.g. LH=Nov30, Start=Dec1 -> diff=1 -> cons=0
                    // e.g. LH=Nov29, Start=Dec1 -> diff=2 -> cons=1 (worked Nov30)
                    if (diffDays > 1) {
                        consecutive = diffDays - 1;
                    }
                }

                dates.forEach(d => {
                    const s = getShift(formatDate(d), m.id);
                    if (getShiftDays(s) > 0) { // Any work (full or half day)
                        consecutive++;
                        if (consecutive > limit) score += 1000; // Hard Penalty for exceeding limit

                        // Soft Penalty: Prefer shorter streaks even if within limit
                        // e.g. 5 days = 25, 2 days = 4. 2+3=13 vs 5=25.
                        // Weighting needs to be high enough to matter but low enough not to override quotas
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

        // 2-B. Directed Flattening (Deterministic)
        // Before random optimization, try to forcibly flatten the daily counts to Max-Min <= 1
        // by moving one person from MaxDay to MinDay.
        for (let k = 0; k < state.members.length * 3; k++) {
            // 1. Calculate current counts
            const dailyCounts = {};
            let minC = 9999, maxC = -1;
            let minDates = [], maxDates = [];

            workDays.forEach(d => {
                const dateStr = formatDate(d);
                // SKIP half-day settings and TARGET days from variance calculation
                const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
                const setting = state.settings.workDays[dayNames[d.getDay()]];

                const hasTarget = state.dailyTargets && state.dailyTargets[dateStr] !== undefined && state.dailyTargets[dateStr] !== null && state.dailyTargets[dateStr] !== '';
                if (setting === 'HALF_AM' || setting === 'HALF_PM' || setting === 'OFF' || hasTarget) return;

                let c = 0;
                state.members.forEach(m => c += getShiftDays(getShift(dateStr, m.id)));
                dailyCounts[dateStr] = c;

                if (c < minC) minC = c;
                if (c > maxC) maxC = c;
            });

            Object.entries(dailyCounts).forEach(([ds, c]) => {
                if (c === minC) minDates.push(ds);
                if (c === maxC) maxDates.push(ds);
            });

            // If already flat enough, stop
            if (maxC - minC < 2) break;

            // 2. Try to move a shift from MaxDay -> MinDay
            let moved = false;
            // Try random pair of max/min dates to avoid stuck loops
            const maxD = maxDates[Math.floor(Math.random() * maxDates.length)];
            const minD = minDates[Math.floor(Math.random() * minDates.length)];

            // Identify a member who is Working on MaxD AND NOT Working on MinD
            // AND not fixed on either.
            const candidates = state.members.filter(m => {
                if (isFixed(maxD, m.id) || isFixed(minD, m.id)) return false;
                const sMax = getShift(maxD, m.id);
                const sMin = getShift(minD, m.id);
                // Working on Max (ON_SITE/TRIP) and OFF on Min
                return (getShiftDays(sMax) >= 1 && getShiftDays(sMin) === 0 && sMin === 'OFF');
            });

            if (candidates.length > 0) {
                // Pick one
                const m = candidates[Math.floor(Math.random() * candidates.length)];
                const sMax = getShift(maxD, m.id); // e.g. ON_SITE

                // Move: MaxD -> OFF, MinD -> sMax (preserving type usually ON_SITE)
                // But check MinD weekday setting
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

                // Update score for next iteration
                currentScore = calculateScore();
            }

            if (!moved) break; // Could not find any valid move to improve
        }

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

        // --- Auto-Update Next Month ---
        updateNextMonthLastHolidays(state.settings.yearMonth);

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
                warnings.push(`📅 ${dateStr}: 必要${targetNum}人 → 実際${count}人`);
            }
        }
    });

    // Check variance (difference >= 2)
    // Check variance (difference >= 2)
    // DISABLED per user request: "メッセージ不要" avoiding automated retries and alerts for variance.
    // Check Daily Variance (difference >= 2) per user request
    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

    // First pass: Recalculate max/min considering ONLY full work days
    let validMaxCount = -1;
    let validMinCount = 9999;
    let hasValidDays = false;

    Object.entries(dailyCounts).forEach(([dateStr, count]) => {
        const d = new Date(dateStr);
        const dayKey = dayNames[d.getDay()];
        const setting = state.settings.workDays[dayKey];
        // Skip if setting is HALF_AM or HALF_PM or OFF OR has Target
        if (setting === 'HALF_AM' || setting === 'HALF_PM' || setting === 'OFF') return;
        const hasTarget = state.dailyTargets && state.dailyTargets[dateStr] !== undefined && state.dailyTargets[dateStr] !== null && state.dailyTargets[dateStr] !== '';
        if (hasTarget) return;

        hasValidDays = true;
        if (count > validMaxCount) validMaxCount = count;
        if (count < validMinCount) validMinCount = count;
    });

    if (hasValidDays) {
        const variance = validMaxCount - validMinCount;
        if (variance >= 2) {
            // Find dates with max and min counts
            const maxDates = [];
            const minDates = [];

            Object.entries(dailyCounts).forEach(([dateStr, count]) => {
                const d = new Date(dateStr);
                const dayKey = dayNames[d.getDay()];
                const setting = state.settings.workDays[dayKey];

                const hasTarget = state.dailyTargets && state.dailyTargets[dateStr] !== undefined && state.dailyTargets[dateStr] !== null && state.dailyTargets[dateStr] !== '';
                if (setting === 'HALF_AM' || setting === 'HALF_PM' || setting === 'OFF' || hasTarget) return;

                if (count === validMaxCount) maxDates.push(dateStr);
                if (count === validMinCount) minDates.push(dateStr);
            });

            warnings.push(`📊 日次出勤人数の差が大きすぎます: 最大${validMaxCount}人 - 最小${validMinCount}人 = ${variance}人差`);
            warnings.push(`   最大: ${maxDates.join(', ')} (${validMaxCount}人)`);
            warnings.push(`   最小: ${minDates.join(', ')} (${validMinCount}人)`);
            warnings.push(`   推奨: 差を1人以内に抑えるため、連続勤務制限を緩和するか、メンバー数を調整してください`);
            warnings.push(`   (※休日・半休設定・人数指定ありの日は判定から除外しています)`);
        }
    }

    /*
    const variance = maxCount - minCount;
    if (variance >= 2) {
        // Find dates with max and min counts
        const maxDates = [];
        const minDates = [];
 
        Object.entries(dailyCounts).forEach(([dateStr, count]) => {
            if (count === maxCount) maxDates.push(dateStr);
            if (count === minDates) minDates.push(dateStr);
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
            warnings.push(`⚠️ 固定設定が出勤人数の偏りを引き起こしています`);
            fixedIssues.forEach(issue => warnings.push(`   ${issue}`));
        }
    }
    */

    // Check consecutive work days
    const limit = state.settings.maxConsecutive || 5;
    state.members.forEach(m => {
        let consecutive = 0;

        // Initialize consecutive based on last holiday
        const lh = getLastHoliday(m.id);
        if (lh) {
            const startOfMonth = dates[0];
            const lhDate = new Date(lh);
            const diffTime = startOfMonth - lhDate;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays > 1) {
                consecutive = diffDays - 1;
            }
        }

        let maxConsecutive = consecutive; // Start max with initial carry-over

        dates.forEach(d => {
            const s = getShift(formatDate(d), m.id);
            if (getShiftDays(s) > 0) { // Any work (full or half day)
                consecutive++;
                if (consecutive > maxConsecutive) maxConsecutive = consecutive;
                if (consecutive > limit) {
                    // Only push if not already warned for this sequence/date? 
                    // Actually, just pushing dates is fine.
                    // But we might duplicate warnings if we are not careful.
                    // For now simple push.
                    // violationDates.push(formatDate(d));
                }
            } else {
                consecutive = 0;
            }
        });

        if (maxConsecutive > limit) {
            // Recalculate strict violation dates for display
            // This is a bit lazy but ensures accuracy
            let tempCons = 0;
            if (lh) {
                const diffVideo = Math.ceil((dates[0] - new Date(lh)) / (86400000));
                if (diffVideo > 1) tempCons = diffVideo - 1;
            }

            let violatedRanges = [];
            let currentRangeStart = null;

            dates.forEach(d => {
                const s = getShift(formatDate(d), m.id);
                if (getShiftDays(s) > 0) {
                    if (tempCons === 0) currentRangeStart = formatDate(d); // Start of working streak
                    tempCons++;
                } else {
                    if (tempCons > limit) {
                        // End of a violation streak
                        // violatedRanges.push(...)
                    }
                    tempCons = 0;
                    currentRangeStart = null;
                }
            });
            // Check if ended in violation
            // Simplified warning message:
            warnings.push(`👤 ${m.name}: 連続${maxConsecutive}日勤務 (制限: ${limit}日) ※前月考慮`);
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

    // Cycle: ON_SITE -> TRIP -> OFF -> HALF_AM -> HALF_PM -> ON_SITE
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
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    // Append to container
    container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => toast.classList.add('show'));

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
        backItem.innerHTML = '←戻る';
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
        updateUIInputs();
    }
}

function renderSidebar() {
    els.memberList.innerHTML = '';

    // --- Members Section ---
    state.members.forEach(m => {
        const div = document.createElement('div');
        div.className = `member-item ${uiState.focusedMemberId === m.id ? 'focused' : ''}`;
        div.style.display = 'flex';
        div.style.flexDirection = 'column';
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

        const lastHolidayVal = getLastHoliday(m.id);

        div.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:space-between; width:100%;">
                <div style="font-weight:500;">${m.name}</div>
                <div style="display:flex; align-items:center; gap:4px;">
                    <span style="font-size:0.7rem; color:var(--text-muted);">追加オフ</span>
                    <input type="number" value="${m.extraOff}" min="0" style="width:40px; padding:2px; font-size:0.8rem; border:1px solid var(--border); border-radius:4px;"
                        onchange="updateMember('${m.id}', 'extraOff', this.value)" onClick="event.stopPropagation()">
                    <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation(); deleteMember('${m.id}')" style="padding:4px; color:#ef4444;">
                        <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
                    </button>
                </div>
            </div>
            
            <div style="display:flex; align-items:center; gap:4px; font-size:0.75rem; border-top:1px dashed #eee; padding-top:4px;">
                <label style="color:var(--text-muted);">前月最終休日:</label>
                <input type="date" id="lh-${m.id}" value="${lastHolidayVal}" 
                    style="flex:1; border:1px solid var(--border); border-radius:4px; padding:2px; font-size:0.7rem;"
                    onchange="updateLastHoliday('${m.id}', this.value)" onClick="event.stopPropagation()">
                <button class="btn btn-sm btn-outline icon-only" title="自動取得" 
                    onclick="event.stopPropagation(); autoDetectLastHoliday('${m.id}')" style="padding:2px 4px;">
                    <i data-lucide="refresh-cw" style="width:12px; height:12px;"></i>
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
                    ${target ? `<span style="font-size:0.7rem; background:#e0f2fe; color:#0369a1; padding:1px 3px; border-radius:3px;">必要${target}</span>` : ''}
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
                ${m.extraOff > 0 ? `<div style="font-size:0.65rem; color:#ef4444;">+オフ ${m.extraOff}</div>` : ''}
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
        html += `<tr><td class="timeline-footer-label">目標差異</td>`;
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
    // Iterate only active members to avoid counting deleted "ghost" members
    let count = 0;
    state.members.forEach(m => {
        const s = state.shifts[dateStr][m.id];
        if (s === 'ON_SITE') count++;
    });
    return count;
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

    els.statTotalSlots.textContent = totalAssigned;
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
        alert("移動先が固定されています。");
        dragSource = null;
        return;
    }

    let status = 'ON_SITE';
    if (fromDate) {
        status = state.shifts[fromDate][memberId] || 'ON_SITE';
        if (state.fixed[fromDate] && state.fixed[fromDate][memberId]) {
            alert("移動元が固定されています。");
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
        alert("移動先が固定されています。");
        dragSource = null;
        return;
    }

    let status = 'ON_SITE';
    if (fromDate) {
        status = state.shifts[fromDate][srcMemberId] || 'ON_SITE';

        if (state.fixed[fromDate] && state.fixed[fromDate][srcMemberId]) {
            alert("移動元が固定されています。");
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

