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

const TEAM_COLORS = [
    '#3b82f6', // Blue
    '#ef4444', // Red
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#84cc16'  // Lime
];

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
        maxConsecutive: 5, // limit consecutive work days
        currentTeamId: 't1' // Default to Team 1
    },
    teams: [
        { id: 't1', name: 'チーム1' }
    ],
    members: [
        { id: 'm1', name: '佐藤', extraOff: 0, teamId: 't1' },
        { id: 'm2', name: '鈴木', extraOff: 0, teamId: 't1' },
        { id: 'm3', name: '高橋', extraOff: 0, teamId: 't1' },
        { id: 'm4', name: '田中', extraOff: 1, teamId: 't1' }
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
    optimizationStrength: document.getElementById('optimization-strength'),

    // Team Elements
    teamSelect: document.getElementById('team-select'),
    btnAddTeam: document.getElementById('btn-add-team'),
    btnEditTeam: document.getElementById('btn-edit-team'),
    btnDeleteTeam: document.getElementById('btn-delete-team')
};

// --- Team Helpers ---
function getActiveMembers() {
    const tid = state.settings.currentTeamId;
    if (!tid || tid === 'ALL') {
        return state.members;
    }
    return state.members.filter(m => m.teamId === tid);
}

function getTeamName(id) {
    const t = state.teams.find(x => x.id === id);
    return t ? t.name : '';
}

function getTeamColor(teamId) {
    if (!teamId) return '#cbd5e1';
    const idx = state.teams.findIndex(t => t.id === teamId);
    if (idx === -1) return '#cbd5e1';
    return TEAM_COLORS[idx % TEAM_COLORS.length];
}

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

    els.btnGenerate.addEventListener('click', () => {
        console.log("Generate button clicked");
        generateSchedule();
    });
    els.btnReset.addEventListener('click', resetSchedule);
    els.btnPrint.addEventListener('click', () => {
        preparePrint(viewMode);
        window.print();
    });
    els.btnAddMember.addEventListener('click', addMember);

    // Team Events
    if (els.teamSelect) els.teamSelect.addEventListener('change', (e) => switchTeam(e.target.value));
    if (els.btnAddTeam) els.btnAddTeam.addEventListener('click', addTeam);
    if (els.btnEditTeam) els.btnEditTeam.addEventListener('click', editTeam);
    if (els.btnDeleteTeam) els.btnDeleteTeam.addEventListener('click', deleteTeam);

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
function preparePrint(viewMode = 'calendar') {
    const printArea = document.getElementById('print-area');
    if (!printArea) return;
    printArea.innerHTML = ''; // Clear

    const ym = state.settings.yearMonth;

    // Header
    const header = document.createElement('div');
    header.className = 'print-header';
    header.innerHTML = `<h1>${ym} シフト表 (${viewMode === 'timeline' ? 'タイムライン' : 'カレンダー'})</h1>`;
    printArea.appendChild(header);

    if (viewMode === 'timeline') {
        renderPrintTimeline(printArea);
    } else {
        renderPrintCalendar(printArea);
    }
}

function renderPrintTimeline(container) {
    const dates = getDaysInMonth(state.settings.yearMonth);
    const table = document.createElement('table');
    table.className = 'print-timeline';

    // Header Row
    const thead = document.createElement('thead');
    const trHead = document.createElement('tr');

    // Member Name Header
    const thName = document.createElement('th');
    thName.className = 'member-col';
    thName.textContent = '氏名';
    trHead.appendChild(thName);

    // Date Columns
    // Date Columns
    dates.forEach(d => {
        const th = document.createElement('th');
        const dayName = DAYS_JP[d.getDay()];
        th.innerHTML = `${d.getDate()}<br>${dayName}`;
        if (d.getDay() === 0) th.style.color = 'red';
        else if (d.getDay() === 6) th.style.color = 'blue';
        trHead.appendChild(th);
    });
    // Total Header
    const thTotal = document.createElement('th');
    thTotal.textContent = '合計';
    thTotal.style.width = '40px';
    trHead.appendChild(thTotal);

    thead.appendChild(trHead);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    const activeMembers = getActiveMembers();

    // Grouping
    const groups = [];
    state.teams.forEach(t => {
        const members = activeMembers.filter(m => m.teamId === t.id);
        if (members.length > 0) groups.push({ team: t, members });
    });
    const orphans = activeMembers.filter(m => !m.teamId || !state.teams.find(t => t.id === m.teamId));
    if (orphans.length > 0) groups.push({ team: { id: 'orphan', name: '未所属' }, members: orphans });

    groups.forEach(group => {
        // Team Header
        const trTeam = document.createElement('tr');
        const tdTeam = document.createElement('td');
        tdTeam.colSpan = dates.length + 2; // +1 Name, +1 Total
        tdTeam.style.textAlign = 'left';
        tdTeam.style.background = '#f1f5f9';
        tdTeam.style.fontWeight = 'bold';
        tdTeam.textContent = `▼ ${group.team.name}`;
        trTeam.appendChild(tdTeam);
        tbody.appendChild(trTeam);

        // Members
        group.members.forEach(m => {
            const tr = document.createElement('tr');

            // Name
            const tdName = document.createElement('td');
            tdName.className = 'member-col';
            tdName.textContent = m.name;
            tr.appendChild(tdName);

            let memberTotal = 0;

            // Shifts
            dates.forEach(d => {
                const dateStr = formatDate(d);
                const shift = getShift(dateStr, m.id);
                const td = document.createElement('td');
                td.className = 'shift-cell';

                if (shift && shift !== 'OFF') {
                    // Count days
                    memberTotal += getShiftDays(shift);

                    const icon = SHIFT_ICONS[shift] || '';
                    td.textContent = icon;
                    // Background for half days for visibility
                    if (shift === 'HALF_AM' || shift === 'HALF_PM') {
                        td.style.backgroundColor = '#fef3c7'; // Light amber
                    }
                }
                tr.appendChild(td);
            });

            // Member Total Column
            const tdTotal = document.createElement('td');
            tdTotal.className = 'shift-cell';
            tdTotal.style.fontWeight = 'bold';
            tdTotal.textContent = memberTotal > 0 ? memberTotal : '';
            tr.appendChild(tdTotal);

            tbody.appendChild(tr);
        });

        // Team Summary
        const trSum = document.createElement('tr');
        trSum.className = 'summary-row';
        const tdSumLabel = document.createElement('td');
        tdSumLabel.textContent = '計';
        tdSumLabel.style.textAlign = 'right';
        trSum.appendChild(tdSumLabel);

        let groupTotal = 0;

        dates.forEach(d => {
            const dateStr = formatDate(d);
            let count = 0;
            group.members.forEach(m => {
                const s = getShift(dateStr, m.id);
                count += getShiftDays(s);
            });
            groupTotal += count;

            const tdSum = document.createElement('td');
            tdSum.textContent = count > 0 ? count : '';
            trSum.appendChild(tdSum);
        });

        // Group Total Cell (Final column)
        const tdGroupTotal = document.createElement('td');
        tdGroupTotal.style.fontWeight = 'bold';
        tdGroupTotal.textContent = groupTotal > 0 ? groupTotal : '';
        trSum.appendChild(tdGroupTotal);

        tbody.appendChild(trSum);
    });

    // --- Grand Total (All Teams) ---
    const tfoot = document.createElement('tfoot');
    const trGrandTotal = document.createElement('tr');
    trGrandTotal.className = 'summary-row grand-total';
    trGrandTotal.style.backgroundColor = '#e2e8f0'; // Darker gray for emphasis
    trGrandTotal.style.borderTop = '2px solid #64748b';

    const tdGrandLabel = document.createElement('td');
    tdGrandLabel.textContent = '総合計';
    tdGrandLabel.style.fontWeight = 'bold';
    tdGrandLabel.style.textAlign = 'right';
    trGrandTotal.appendChild(tdGrandLabel);

    let grandTotalSum = 0;

    dates.forEach(d => {
        const dateStr = formatDate(d);
        let count = 0;
        activeMembers.forEach(m => {
            const s = getShift(dateStr, m.id);
            count += getShiftDays(s);
        });
        grandTotalSum += count;

        const tdSum = document.createElement('td');
        tdSum.style.fontWeight = 'bold';
        tdSum.style.textAlign = 'center'; // Center align for consistency
        tdSum.textContent = count > 0 ? count : '';
        trGrandTotal.appendChild(tdSum);
    });

    // Final Total Cell
    const tdFinalTotal = document.createElement('td');
    tdFinalTotal.style.fontWeight = 'bold';
    tdFinalTotal.style.textAlign = 'center';
    tdFinalTotal.textContent = grandTotalSum > 0 ? grandTotalSum : '';
    trGrandTotal.appendChild(tdFinalTotal);

    tfoot.appendChild(trGrandTotal);
    table.appendChild(tfoot);

    table.appendChild(tbody);
    // table.appendChild(tfoot); // tfoot usually goes before body in HTML4, but after is fine in HTML5. Let's append it to table. 
    // Actually table.appendChild(tbody) was already called. I should append tfoot after tbody.
    table.appendChild(tfoot);
    container.appendChild(table);
}

function renderPrintCalendar(container) {
    const table = document.createElement('table');
    table.className = 'print-calendar';

    // Header Row
    const thead = document.createElement('thead');
    const trHead = document.createElement('tr');
    ['月', '火', '水', '木', '金', '土', '日'].forEach((d, i) => {
        const th = document.createElement('th');
        th.textContent = d;
        if (i === 5) th.style.color = 'blue';
        if (i === 6) th.style.color = 'red'; // Sunday/Holiday color
        trHead.appendChild(th);
    });
    thead.appendChild(trHead);
    table.appendChild(thead);

    // Body
    const tbody = document.createElement('tbody');
    const dates = getDaysInMonth(state.settings.yearMonth);

    // Calendar Layout Logic
    let firstDay = dates[0].getDay();
    firstDay = (firstDay === 0) ? 6 : firstDay - 1;

    let tr = document.createElement('tr');
    // Empty cells
    for (let i = 0; i < firstDay; i++) {
        tr.appendChild(document.createElement('td'));
    }

    // Helper for grouping shifts by Team
    const getTeamIndex = (tid) => state.teams.findIndex(t => t.id === tid);
    const activeMembers = getActiveMembers();
    // Sort members by Team
    activeMembers.sort((a, b) => getTeamIndex(a.teamId) - getTeamIndex(b.teamId));

    dates.forEach((d, idx) => {
        if (tr.children.length === 7) {
            tbody.appendChild(tr);
            tr = document.createElement('tr');
        }

        const dateStr = formatDate(d);
        const td = document.createElement('td');

        // Date Number
        const dateDiv = document.createElement('div');
        dateDiv.className = 'print-date';
        dateDiv.textContent = d.getDate();
        if (d.getDay() === 0) dateDiv.style.color = 'red';
        if (d.getDay() === 6) dateDiv.style.color = 'blue';
        td.appendChild(dateDiv);

        // Shifts Content
        const contentDiv = document.createElement('div');
        contentDiv.className = 'print-cell-content';

        // List members working on this day
        activeMembers.forEach(m => {
            const shift = getShift(dateStr, m.id);
            if (!shift || shift === 'OFF') return;

            const item = document.createElement('div');
            item.className = 'print-shift-item';

            // Team indicator
            const teamColor = getTeamColor(m.teamId);
            item.style.borderLeft = `4px solid ${teamColor}`;
            item.style.paddingLeft = '4px';

            item.textContent = m.name.substring(0, 3);

            // Add symbol if special shift
            if (shift !== 'ON_SITE') {
                const icon = SHIFT_ICONS[shift];
                if (icon) item.textContent += icon;
            }

            contentDiv.appendChild(item);
        });

        td.appendChild(contentDiv);
        tr.appendChild(td);
    });

    // Fill last row
    while (tr.children.length < 7) {
        tr.appendChild(document.createElement('td'));
    }
    tbody.appendChild(tr);
    table.appendChild(tbody);
    container.appendChild(table);

    // --- Team Legend ---
    const legendDiv = document.createElement('div');
    legendDiv.className = 'print-legend';
    legendDiv.style.marginTop = '15px';
    legendDiv.style.fontSize = '0.8rem';
    legendDiv.style.display = 'flex';
    legendDiv.style.flexWrap = 'wrap';
    legendDiv.style.gap = '15px';

    state.teams.forEach(t => {
        const teamSet = document.createElement('div');
        teamSet.style.display = 'flex';
        teamSet.style.alignItems = 'center';
        teamSet.style.border = '1px solid #ddd';
        teamSet.style.padding = '4px 8px';
        teamSet.style.borderRadius = '4px';

        const colorBox = document.createElement('div');
        colorBox.style.width = '12px';
        colorBox.style.height = '12px';
        colorBox.style.backgroundColor = getTeamColor(t.id);
        colorBox.style.marginRight = '6px';
        colorBox.style.border = '1px solid #999';

        const teamName = document.createElement('span');
        teamName.style.fontWeight = 'bold';
        teamName.style.marginRight = '8px';
        teamName.textContent = t.name;

        // Members in this team
        const members = getActiveMembers().filter(m => m.teamId === t.id).map(m => m.name);
        const memberList = document.createElement('span');
        memberList.style.color = '#555';
        memberList.textContent = `(${members.join(', ')})`;

        teamSet.appendChild(colorBox);
        teamSet.appendChild(teamName);
        teamSet.appendChild(memberList);
        legendDiv.appendChild(teamSet);
    });

    container.appendChild(legendDiv);
}

// Hook up events






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

// --- Logic: Settings ---
function updateSetting(key, val) {
    if (key === 'baseOff' || key === 'maxConsecutive' || key === 'yearMonth' || key === 'optimizationStrength') {
        state.settings[key] = val; // Always write to global
        saveState();
        render(); // Full re-render to update calendar/timeline
    }
}

function updateWorkDay(day, val) {
    if (!state.settings.workDays) state.settings.workDays = {};
    state.settings.workDays[day] = val; // Always write to global
    saveState();
    renderSidebar();
}

function getTeamName(teamId) {
    if (teamId === 'ALL') return '全員 (全体)';
    const t = state.teams.find(x => x.id === teamId);
    return t ? t.name : 'Unknown Team';
}

function getActiveMembers() {
    const current = state.settings.currentTeamId;
    if (!current || current === 'ALL') {
        return state.members;
    }
    return state.members.filter(m => m.teamId === current);
}

function addMember() {
    const name = prompt("メンバー名を入力してください:", "New Member");
    if (!name) return;
    const id = 'm' + Date.now();
    const teamId = (state.settings.currentTeamId && state.settings.currentTeamId !== 'ALL') ? state.settings.currentTeamId : undefined;
    state.members.push({ id, name, extraOff: 0, teamId });
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

// --- Team Management ---
function renderTeams() {
    if (!els.teamSelect) return;

    const current = state.settings.currentTeamId || 'ALL';
    els.teamSelect.innerHTML = '<option value="ALL">チーム全体</option>';

    state.teams.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.name;
        if (t.id === current) opt.selected = true;
        els.teamSelect.appendChild(opt);
    });

    // Update buttons state
    if (els.btnEditTeam) els.btnEditTeam.disabled = (current === 'ALL');
    if (els.btnDeleteTeam) els.btnDeleteTeam.disabled = (current === 'ALL');
}

function switchTeam(teamId) {
    state.settings.currentTeamId = teamId;
    saveState();
    render();
}

function addTeam() {
    const name = prompt("新しいチーム名を入力してください:");
    if (!name) return;

    // Generate ID
    const id = 't' + Date.now();
    state.teams.push({ id, name });

    // Switch to new team
    state.settings.currentTeamId = id;

    saveState();
    render();
}

function editTeam() {
    const tid = state.settings.currentTeamId;
    if (!tid || tid === 'ALL') return;

    const team = state.teams.find(t => t.id === tid);
    if (!team) return;

    const newName = prompt("チーム名を編集:", team.name);
    if (newName && newName !== team.name) {
        team.name = newName;
        saveState();
        render();
    }
}

function deleteTeam() {
    const tid = state.settings.currentTeamId;
    if (!tid || tid === 'ALL') return;

    if (!confirm("チームを削除しますか？\n所属メンバーは「チームなし」になります。")) return;

    // Remove team
    state.teams = state.teams.filter(t => t.id !== tid);

    // Unassign members
    state.members.forEach(m => {
        if (m.teamId === tid) {
            delete m.teamId; // or set to undefined
        }
    });

    state.settings.currentTeamId = 'ALL';
    saveState();
    render();
}

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

async function generateSchedule(retryCount = 0) {
    // Show Progress UI
    const progressModal = document.getElementById('progress-modal');
    console.log('Starting generation...', progressModal);

    // DEBUG: Alert to confirm function is running
    // alert("Generating...");
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');

    if (retryCount === 0) {
        // DEBUG: Confirm entry
        // alert("Starting Generation (Retry: 0)");

        if (progressModal) {
            progressModal.style.setProperty('display', 'flex', 'important');
            console.log("Modal display set to flex");
        } else {
            console.error("Progress Modal element not found!");
            alert("Error: Progress Modal not found");
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
        // Goal: Minimize Variance of Daily Attendance + Penalty for Consecutive > N + Conditions

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

                    // NEW: Daily Team Balance Penalty
                    // If target is set, ensure attendance is distributed across teams
                    let tMin = 9999, tMax = -1;
                    state.teams.forEach(t => {
                        const c = teamCounts[t.id];
                        if (c < tMin) tMin = c;
                        if (c > tMax) tMax = c;
                    });

                    // Allow small variance (1) but penalize 2+ HEAVILY to force balance
                    if (tMax !== -1) {
                        const diff = tMax - tMin;
                        if (diff >= 2) {
                            score += diff * 50000;
                        } else if (diff >= 1) {
                            score += 500; // Small penalty to prefer perfect balance (1,1,1) over (1,1,2) if possible
                        }
                    }
                }

                // Variance tracking
                // Stick to Global Settings for Variance Logic (check global work days)
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

            // NEW: Strict Variance Penalty (Per Team)
            // Ensure each team is also flat locally to prevent "Team A works, Team B rests" imbalance.
            state.teams.forEach(t => {
                const teamMembers = activeMembers.filter(m => m.teamId === t.id);
                if (teamMembers.length === 0) return;

                let tMin = 9999, tMax = -1;
                workDays.forEach(d => {
                    const dateStr = formatDate(d);
                    // Skip check for Half/Off/Target days (using GLOBAL settings)
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
                    score += diff * 8000; // Strong penalty for team imbalance, slightly less than global
                }
            });

            // B. Consecutive Shifts (Penalty for > N) -> Per Team
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

        // 2-B. Directed Flattening (Determinstic) - Enhanced
        // Function to perform flattening on a specific subset of members
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

                // If flat enough, stop
                if (maxC !== -1 && (maxC - minC) < 2) break;

                Object.entries(dailyCounts).forEach(([ds, c]) => {
                    if (c === minC) minDates.push(ds);
                    if (c === maxC) maxDates.push(ds);
                });

                // 2. Try to move a shift from ANY MaxDay -> ANY MinDay
                let moved = false;

                // Randomize order of max/min dates to avoid stuck loops
                minDates.sort(() => Math.random() - 0.5);
                maxDates.sort(() => Math.random() - 0.5);

                outerLoop:
                for (const maxD of maxDates) {
                    for (const minD of minDates) {
                        if (maxD === minD) continue;

                        // Identify ALL candidates who are Working on MaxD AND NOT Working on MinD
                        const candidates = targetMembers.filter(m => {
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
                            // Update score? Not strictly needed inside this helper as it's deterministic heuristics
                            // But usually good to keep state consistent if score is used elsewhere
                            break outerLoop;
                        }
                    }
                }
                if (!moved) break;
            }
        };

        // Phase 1: Flatten Per Team (Prevent "Team A works, Team B rests" imbalance)
        state.teams.forEach(t => {
            const teamMembers = activeMembers.filter(m => m.teamId === t.id);
            if (teamMembers.length > 0) {
                performFlattening(teamMembers, 200);
            }
        });

        // Phase 2: Flatten Global (Smooth out remaining bumps)
        performFlattening(activeMembers, 500);

        // Recalculate score after flattening
        currentScore = calculateScore();

        // Get optimization strength from UI
        const strength = els.optimizationStrength ? els.optimizationStrength.value : 'medium';
        const ITERATIONS = {
            'weak': 3000,      // 弱: 速い、精度は低め
            'medium': 10000,   // 中: バランス (デフォルト)
            'strong': 30000,   // 強: 遅いが高精度
            'strongest': 300000 // 最強: 非常に遅いが最高精度 (10倍)
        }[strength] || 10000;

        const CHUNK_SIZE = 1000;
        for (let i = 0; i < ITERATIONS; i++) {
            // Pick Member
            const m = state.members[Math.floor(Math.random() * state.members.length)];
            const mWorkDays = state.settings.workDays; // Use global settings

            // Pick 2 Assignable Days to swap
            // Use local helper or simple filter
            const assignableDates = dates.filter(d => {
                const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
                const setting = mWorkDays[dayNames[d.getDay()]];
                return setting !== 'OFF';
            });

            if (assignableDates.length < 2) continue;

            const d1 = assignableDates[Math.floor(Math.random() * assignableDates.length)];
            const d2 = assignableDates[Math.floor(Math.random() * assignableDates.length)];

            const dateStr1 = formatDate(d1);
            const dateStr2 = formatDate(d2);

            if (dateStr1 === dateStr2) continue;
            if (isFixed(dateStr1, m.id) || isFixed(dateStr2, m.id)) continue;

            const s1 = getShift(dateStr1, m.id);
            const s2 = getShift(dateStr2, m.id);

            if (s1 === s2) continue; // No functional change

            // Helper to determine shift type for a date based on MEMBER settings
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
                // Accept
                currentScore = newScore;
            } else {
                // Revert
                setShift(dateStr1, m.id, s1);
                setShift(dateStr2, m.id, s2);
            }

            // Yield control for Progress UI
            if (i % CHUNK_SIZE === 0) {
                const percent = Math.round((i / ITERATIONS) * 100);
                if (progressBar) progressBar.style.width = `${percent}%`;
                if (progressText) progressText.textContent = `${percent}%`;
                await new Promise(r => setTimeout(r, 0));
            }
        }

        // Check if we need to retry with different initial shuffle
        const finalWarnings = validateSchedule();
        const hasVarianceIssue = finalWarnings.some(w => w.includes('日次出勤人数の差が大きすぎます'));

        if (hasVarianceIssue && retryCount < 5) {
            // Show retry notification
            if (progressText) progressText.textContent = `リトライ中 (${retryCount + 1}/5)...`;
            await new Promise(r => setTimeout(r, 500));
            await generateSchedule(retryCount + 1);
            return;
        }

        // --- Auto-Update Next Month ---
        updateNextMonthLastHolidays(state.settings.yearMonth);

        saveState();
        render();

        if (progressModal) progressModal.style.display = 'none';

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
        if (progressModal) progressModal.style.display = 'none';
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
        const list = getActiveMembers();
        list.forEach(m => {
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
    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

    let validMaxCount = -1;
    let validMinCount = 9999;
    let hasValidDays = false;

    Object.entries(dailyCounts).forEach(([dateStr, count]) => {
        const d = new Date(dateStr);
        const dayKey = dayNames[d.getDay()];
        const setting = state.settings.workDays[dayKey];
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

    // Check consecutive work days (Per Team Limit)
    const list = getActiveMembers();
    const limit = state.settings.maxConsecutive || 5; // Use global setting
    list.forEach(m => {
        let consecutive = 0;

        // Initialize from last holiday
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

        let maxConsecutive = consecutive;

        dates.forEach(d => {
            const s = getShift(formatDate(d), m.id);
            if (getShiftDays(s) > 0) {
                consecutive++;
                if (consecutive > maxConsecutive) maxConsecutive = consecutive;
            } else {
                consecutive = 0;
            }
        });

        if (maxConsecutive > limit) {
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
    const list = getActiveMembers();
    list.forEach(m => {
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
        renderTeams(); // Update Select Box
        renderCalendar();
        updateStats();
        updateUIInputs();
    }
}

function renderSidebar() {
    els.memberList.innerHTML = '';

    els.memberList.innerHTML = '';

    // --- Members Section ---
    // --- Members Section ---
    const list = getActiveMembers();

    // Sort by Team
    const getTeamIndex = (tid) => state.teams.findIndex(t => t.id === tid);
    list.sort((a, b) => {
        const idxA = getTeamIndex(a.teamId);
        const idxB = getTeamIndex(b.teamId);
        if (idxA !== idxB) return idxA - idxB;
        // Then by original order (or index in activeMembers, but stable sort preserves it mostly)
        return 0;
    });

    list.forEach(m => {
        const div = document.createElement('div');
        div.className = `member-item ${uiState.focusedMemberId === m.id ? 'focused' : ''}`;
        div.style.display = 'flex';

        // Team Background Color (Faint)
        // Team Background Color (Faint)
        const teamId = m.teamId || (state.teams[0] ? state.teams[0].id : null);
        if (teamId) {
            const hex = getTeamColor(teamId);
            // Robust Hex to RGB
            let r = 0, g = 0, b = 0;
            if (hex.length === 7) {
                r = parseInt(hex.slice(1, 3), 16);
                g = parseInt(hex.slice(3, 5), 16);
                b = parseInt(hex.slice(5, 7), 16);
            }

            // Force application
            let bgStyle = `rgba(${r}, ${g}, ${b}, 0.15)`;



            div.style.setProperty('background-color', bgStyle, 'important');
            div.style.borderLeft = `4px solid ${hex}`; // Stronger visual cue
            div.style.borderColor = 'var(--border)'; // Keep outer border standard
        }
        div.style.flexDirection = 'column';
        div.style.gap = '8px';
        div.style.padding = '8px';
        div.style.marginBottom = '4px';
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
                    <span style="font-size:0.7rem; color:var(--text-muted);">休日＋</span>
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

        // Helper to sort members by Team Index (and then by Member Index/Name)
        const getTeamIndex = (tid) => state.teams.findIndex(t => t.id === tid);

        // Render shifts for this date
        const list = getActiveMembers();

        // SORT: Group by Team
        list.sort((a, b) => {
            const tIdxA = getTeamIndex(a.teamId);
            const tIdxB = getTeamIndex(b.teamId);
            if (tIdxA !== tIdxB) return tIdxA - tIdxB;
            // Same team, keep original order (or sort by ID/Name?)
            // Assuming list is already in display order
            return 0;
        });

        list.forEach(m => {
            const shift = getShift(dateStr, m.id);
            if (!shift || shift === 'OFF') return; // Skip OFF or empty

            // Skip if focus mode and not focused member
            if (uiState.focusedMemberId && uiState.focusedMemberId !== m.id) return;

            const chip = document.createElement('div');
            chip.className = `shift-chip type-${shift.toLowerCase().replace('_', '-')}`;
            chip.draggable = true;
            // Display first 3 characters of name
            chip.textContent = m.name.substring(0, 3);

            // Team Color Indicator (Left Border)
            const tColor = getTeamColor(m.teamId);
            chip.style.borderLeft = `3px solid ${tColor}`;

            // Background Tint (Faint)
            if (m.teamId) {
                const hex = tColor;
                const r = parseInt(hex.slice(1, 3), 16);
                const g = parseInt(hex.slice(3, 5), 16);
                const b = parseInt(hex.slice(5, 7), 16);
                // Only apply if it's ON_SITE (white/blue gradient) to avoid clashing with AM/PM colors
                if (shift === 'ON_SITE') {
                    chip.style.backgroundColor = `rgba(${r}, ${g}, ${b}, 0.15)`;
                }
            }

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
        <div class="timeline-scroll-wrapper">
            <table class="timeline-table">
                <thead>
                    <tr>
                        <th class="timeline-member-cell header">メンバー</th>
    `;

    // ... (Loop over dates for headers)
    dates.forEach(d => {
        // ... (existing header logic)
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

    // Added Headers for Stats
    html += `
            <th class="timeline-header-cell" style="width:40px; min-width:40px;">出勤</th>
            <th class="timeline-header-cell" style="width:40px; min-width:40px;">休日</th>
    `;

    html += `
                    </tr >
                </thead >
                <tbody>
    `;

    // Rows: Members Grouped by Team
    const activeMembers = getActiveMembers();
    const groups = [];
    state.teams.forEach(t => {
        const members = activeMembers.filter(m => m.teamId === t.id);
        if (members.length > 0) groups.push({ team: t, members });
    });
    const orphans = activeMembers.filter(m => !m.teamId || !state.teams.find(t => t.id === m.teamId));
    if (orphans.length > 0) groups.push({ team: { id: 'orphan', name: '未所属' }, members: orphans });

    groups.forEach((group, index) => {
        const teamColor = getTeamColor(group.team.id);

        // Calculate faint background color (same logic as member cell)
        let headerBgStyle = 'background-color: #f1f5f9;';
        if (group.team.id !== 'orphan') {
            const hex = teamColor;
            if (hex && hex.length === 7) {
                const r = parseInt(hex.slice(1, 3), 16);
                const g = parseInt(hex.slice(3, 5), 16);
                const b = parseInt(hex.slice(5, 7), 16);
                // Slightly darker than member cell (0.25 vs 0.15) for header distinction
                headerBgStyle = `background-color: rgba(${r}, ${g}, ${b}, 0.25);`;
            }
        }

        // 0. Spacer Row (except first)
        if (index > 0) {
            html += `<tr style="height: 20px; border: none; background: #f1f5f9;"><td colspan="${dates.length + 3}" style="border:none;"></td></tr>`;
        }

        // 1. Team Header Row
        html += `
            <tr class="timeline-team-header" style="font-weight: bold;">
                <td class="timeline-member-cell" style="border-left: 4px solid ${teamColor}; padding-left: 8px; ${headerBgStyle}">
                    ▼ ${group.team.name}
                </td>
                <td colspan="${dates.length + 2}" style="${headerBgStyle}"></td> 
            </tr>
        `;

        // 2. Member Rows
        group.members.forEach(m => {
            const isFocused = uiState.focusedMemberId === m.id;
            const isDimmed = uiState.focusedMemberId && uiState.focusedMemberId !== m.id;

            let rowClass = 'timeline-row';
            if (isFocused) rowClass += ' focused';
            if (isDimmed) rowClass += ' dimmed';

            html += `<tr class="${rowClass}">`;

            // Background Color Logic
            let cellBgStyle = '';
            if (m.teamId) {
                const hex = getTeamColor(m.teamId);
                if (hex && hex.length === 7) {
                    const r = parseInt(hex.slice(1, 3), 16);
                    const g = parseInt(hex.slice(3, 5), 16);
                    const b = parseInt(hex.slice(5, 7), 16);
                    cellBgStyle = `background-color: rgba(${r}, ${g}, ${b}, 0.15);`;
                }
            } else {
                cellBgStyle = 'background-color: white;';
            }

            // Member Name Cell with Team Color Indicator
            html += `<td class="timeline-member-cell" style="border-left: 4px solid ${teamColor}; ${cellBgStyle}">
                <div class="member-info">
                    <div class="member-name">${m.name}</div>
                    ${m.extraOff > 0 ? `<div style="font-size:0.65rem; color:#ef4444;">+休日 ${m.extraOff}</div>` : ''}
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
                }
                html += `</td>`;
            });

            // Add row statistics
            let workDays = 0;
            let daysOff = 0;

            dates.forEach(d => {
                const dateStr = formatDate(d);
                const shift = getShift(dateStr, m.id);
                workDays += getShiftDays(shift);
                if (shift === 'OFF' || !shift) daysOff++;
            });

            // Dedicated Columns for Stats
            html += `
                <td class="timeline-stats-cell" style="text-align:center; font-weight:bold; color:var(--primary);">
                    ${workDays}
                </td>
                <td class="timeline-stats-cell" style="text-align:center; color:var(--text-muted);">
                    ${daysOff}
                </td>
            `;
            html += `</tr>`;
        }); // End Members Loop

        // 3. Team Summary Row
        html += `<tr class="timeline-team-summary" style="background-color: #f8fafc; border-top: 1px dashed #cbd5e1;">
            <td class="timeline-footer-label" style="text-align:right; font-size:0.75rem; color:var(--text-muted);">
                ${group.team.name} 計
            </td>`;

        let groupTotalWork = 0;
        let groupTotalOff = 0;

        dates.forEach(d => {
            const dateStr = formatDate(d);
            let teamCount = 0;
            group.members.forEach(m => {
                const s = getShift(dateStr, m.id);
                teamCount += getShiftDays(s);
            });
            groupTotalWork += teamCount;
            // Off count for team day isn't usually summed vertically like this, but we can do it later if needed.
            // Just output daily work sum
            html += `<td style="text-align:center; font-size:0.75rem; font-weight:bold; color:var(--text-muted);">${teamCount}</td>`;
        });

        // Sum Columns
        group.members.forEach(m => {
            dates.forEach(d => {
                const s = getShift(formatDate(d), m.id);
                if (s === 'OFF' || !s) groupTotalOff++;
            });
        });

        html += `<td style="text-align:center; font-weight:bold;">${groupTotalWork}</td>`;
        html += `<td style="text-align:center; color:var(--text-muted);">${groupTotalOff}</td>`; // Optional
        html += `</tr>`;

    }); // End Groups Loop

    html += `
                </tbody>
                <tfoot>
                    <tr style="height: 20px; border: none; background: #f1f5f9;"><td colspan="${dates.length + 3}" style="border:none;"></td></tr>
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
    // Footer spacer for stat columns
    html += `<td class="timeline-footer-cell"></td><td class="timeline-footer-cell"></td></tr>`;

    // Row 2: Off/Other Count
    html += `<tr><td class="timeline-footer-label">休日/他</td>`;
    dates.forEach(d => {
        const dateStr = formatDate(d);
        const onSiteCount = countOnSite(dateStr);
        const total = state.members.length;
        const offCount = total - onSiteCount;

        html += `<td class="timeline-footer-cell" style="color:#64748b;">${offCount}</td>`;
    });
    html += `<td class="timeline-footer-cell"></td><td class="timeline-footer-cell"></td></tr>`;

    // Row 3: Variance
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
        html += `<td class="timeline-footer-cell"></td><td class="timeline-footer-cell"></td></tr>`;
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
    const list = getActiveMembers();
    list.forEach(m => {
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

            // Merge Saved Data
            state = { ...state, ...parsed };

            // Final safety check
            if (!state.settings.workDays) {
                state.settings.workDays = {
                    mon: 'WORK', tue: 'WORK', wed: 'WORK', thu: 'WORK', fri: 'WORK',
                    sat: 'OFF', sun: 'OFF'
                };
            }

            migrateAndValidateState();

        } catch (e) { console.error("Load failed", e); }
    }
}

// Helper to ensure state data is valid and migrated to latest version
function migrateAndValidateState() {
    // 1. Ensure state.teams is an array
    if (!Array.isArray(state.teams)) {
        state.teams = [];
    }

    // 2. If no teams exist, create Default "Team 1"
    if (state.teams.length === 0) {
        const defaultTeam = { id: 't1', name: 'チーム1' };
        state.teams.push(defaultTeam);
        // Force switch to it immediately so user sees it
        state.settings.currentTeamId = defaultTeam.id;
    }

    // 3. Ensure all members belong to a valid team
    // If a member has no teamId (legacy), or has an invalid teamId, assign to the first available team.
    if (state.members && state.members.length > 0) {
        // Get a fallback team ID (first one)
        const fallbackTeamId = state.teams[0].id;

        state.members.forEach(m => {
            // Check if teamId is missing OR if the teamId it refers to doesn't exist
            const belongsToValidTeam = m.teamId && state.teams.some(t => t.id === m.teamId);

            if (!belongsToValidTeam) {
                m.teamId = fallbackTeamId;
            }
        });
    }

    // 4. Validate Current Team View
    // If currentTeamId is invalid (not 'ALL' and not in teams), reset to 'ALL' or fallback
    const current = state.settings.currentTeamId;
    const validView = current === 'ALL' || state.teams.some(t => t.id === current);

    if (!validView) {
        // Default to the first team if available, otherwise ALL
        state.settings.currentTeamId = state.teams.length > 0 ? state.teams[0].id : 'ALL';
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

            // KEY FIX: Run migration logic to support legacy files or missing team data
            migrateAndValidateState();

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

// --- Update UI Inputs ---
function updateUIInputs() {
    if (!state.settings.yearMonth) return;

    // Always use global settings
    const settings = state.settings;

    if (els.monthInput) els.monthInput.value = settings.yearMonth;
    if (els.settingBaseOff) els.settingBaseOff.value = settings.baseOff;
    if (els.settingMaxConsecutive) els.settingMaxConsecutive.value = settings.maxConsecutive;
    if (els.optimizationStrength) els.optimizationStrength.value = settings.optimizationStrength || 'medium';

    const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    days.forEach(day => {
        const key = 'day' + day.charAt(0).toUpperCase() + day.slice(1);
        if (els[key] && settings.workDays) {
            els[key].value = settings.workDays[day];
        }
    });

    // Color updates for selects
    document.querySelectorAll('.weekday-setting select').forEach(sel => {
        const updateColor = () => {
            if (sel.value === 'OFF') sel.style.color = 'var(--danger)';
            else if (sel.value === 'WORK') sel.style.color = 'var(--text)';
            else sel.style.color = 'var(--primary)';
        };
        updateColor();
        sel.onchange = updateColor;
    });
}

// --- Rendering ---
function renderView() {
    renderSidebar();
    renderTeams();

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

