/**
 * Core Logic & Data Manipulation
 */

// --- Accessors ---

function isWorkDay(date) {
    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const dayKey = dayNames[date.getDay()];
    const setting = state.settings.workDays[dayKey];

    // Global setting check
    if (setting === 'OFF') return false;
    // Note: HALF_AM and HALF_PM are considered work days for generation purposes

    // Check if daily target is explicitly 0 (holiday/closed)
    const dateStr = formatDate(date);
    if (state.dailyTargets && state.dailyTargets[dateStr] !== undefined && state.dailyTargets[dateStr] == 0) {
        return false;
    }

    // Check if all members are fixed as OFF for this date
    if (state.fixed[dateStr] && state.members.length > 0) {
        const allOff = state.members.every(m =>
            state.fixed[dateStr][m.id] === 'OFF'
        );
        if (allOff) return false; // Treat as non-work day
    }

    return true;
}

function getShift(dateStr, memberId) {
    if (state.fixed[dateStr] && state.fixed[dateStr][memberId]) {
        return state.fixed[dateStr][memberId];
    }
    return state.shifts[dateStr] && state.shifts[dateStr][memberId];
}

function isFixed(dateStr, memberId) {
    return state.fixed[dateStr] && state.fixed[dateStr][memberId];
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

function getTeamColor(teamId) {
    if (!teamId) return '#cbd5e1';
    const idx = state.teams.findIndex(t => t.id === teamId);
    if (idx === -1) return '#cbd5e1';
    return TEAM_COLORS[idx % TEAM_COLORS.length];
}

// --- Mutations ---

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
    if (window.render) render();
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
    if (window.render) render();
}

// Expose
window.toggleLock = toggleLock;
window.toggleDayLock = toggleDayLock;

function updateSetting(key, val) {
    if (key === 'baseOff' || key === 'maxConsecutive' || key === 'yearMonth' || key === 'optimizationStrength') {
        state.settings[key] = val; // Always write to global
        saveState();
        if (window.render) render(); // Full re-render
    }
}

function updateWorkDay(day, val) {
    if (!state.settings.workDays) state.settings.workDays = {};
    state.settings.workDays[day] = val; // Always write to global
    saveState();
    if (window.renderSidebar) renderSidebar();
}

async function addMember() {
    const name = await window.showPrompt("メンバー名を入力してください:", "New Member");
    if (!name) return;
    const id = 'm' + Date.now();
    const teamId = (state.settings.currentTeamId && state.settings.currentTeamId !== 'ALL') ? state.settings.currentTeamId : undefined;
    state.members.push({ id, name, extraOff: 0, teamId });
    saveState();
    if (window.renderSidebar) renderSidebar();
}

async function deleteMember(id) {
    if (!await window.showConfirm("削除しますか?")) return;
    state.members = state.members.filter(m => m.id !== id);
    // Cleanup shifts logic could go here but lazy cleanup is fine
    if (window.render) render();
    saveState();
}
window.deleteMember = deleteMember;

window.updateMember = function (id, key, val) {
    const m = state.members.find(x => x.id === id);
    if (m) {
        m[key] = parseInt(val) || 0;
        saveState();
    }
};

// --- Team Management Mutations ---

function switchTeam(teamId) {
    state.settings.currentTeamId = teamId;
    saveState();
    if (window.render) render();
}

async function addTeam() {
    const name = await window.showPrompt("新しいチーム名を入力してください:");
    if (!name) return;

    // Generate ID
    const id = 't' + Date.now();
    state.teams.push({ id, name });

    // Switch to new team
    state.settings.currentTeamId = id;

    saveState();
    if (window.render) render();
}

async function editTeam() {
    const tid = state.settings.currentTeamId;
    if (!tid || tid === 'ALL') return;

    const team = state.teams.find(t => t.id === tid);
    if (!team) return;

    const newName = await window.showPrompt("チーム名を編集:", team.name);
    if (newName && newName !== team.name) {
        team.name = newName;
        saveState();
        if (window.render) render();
    }
}

async function deleteTeam() {
    const tid = state.settings.currentTeamId;
    if (!tid || tid === 'ALL') return;

    if (!await window.showConfirm("チームを削除しますか？\\n所属メンバーは「チームなし」になります。")) return;

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
    if (window.render) render();
}

// --- Conditions ---

window.addCondition = function () {
    state.conditions.push({ type: 'TOGETHER', m1: '', m2: '' });
    if (window.renderSidebar) renderSidebar();
    saveState();
};

window.updateCondition = function (idx, key, val) {
    state.conditions[idx][key] = val;
    saveState();
};

window.deleteCondition = function (idx) {
    state.conditions.splice(idx, 1);
    if (window.renderSidebar) renderSidebar();
    saveState();
};

// --- Daily Targets & Notes ---

window.handleHeaderClick = async function (dateStr) {
    // Left Click: Combined Daily Settings (Headcount + Note)
    const currentTarget = (state.dailyTargets && state.dailyTargets[dateStr] !== undefined) ? state.dailyTargets[dateStr] : '';
    const currentNote = (state.dailyNotes && state.dailyNotes[dateStr]) || '';

    const result = await window.showForm(
        `${dateStr} の設定`,
        "必要人数と行事・メモを入力してください",
        [
            { key: 'target', label: '必要人数 (0で休日扱い, 空欄で解除)', type: 'number', value: currentTarget, placeholder: '例: 3' },
            { key: 'note', label: '行事・メモ', type: 'text', value: currentNote, placeholder: '例: 会議' }
        ]
    );

    if (!result) return;

    // save target
    if (!state.dailyTargets) state.dailyTargets = {};
    if (result.target.trim() === '') {
        delete state.dailyTargets[dateStr];
    } else {
        const num = parseInt(result.target);
        if (!isNaN(num)) state.dailyTargets[dateStr] = num;
    }

    // save note
    if (!state.dailyNotes) state.dailyNotes = {};
    if (result.note.trim() === '') {
        delete state.dailyNotes[dateStr];
    } else {
        state.dailyNotes[dateStr] = result.note;
    }

    saveState();
    if (window.render) render();
};

window.handleHeaderRightClick = async function (e, dateStr) {
    // Right Click alias to same modal for convenience
    e.preventDefault();
    window.handleHeaderClick(dateStr);
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

// --- Last Holiday Logic ---

function getMatchMonthDates(ym) {
    const days = getDaysInMonth(ym);
    return days.map(d => formatDate(d));
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
    const prevYM = getPrevMonth(currentYM);

    // 1. Try to find in previous month data
    const detected = findLastHolidayInMonth(memberId, prevYM);
    if (detected) return detected;

    // 2. Default to last day of previous month
    const [y, m] = prevYM.split('-').map(Number);
    const lastDay = new Date(y, m, 0);
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
    if (window.renderSidebar) renderSidebar();
    if (window.showToast) showToast(`${dateStr ? '設定' : '自動(デフォルト)'}: 前月最終休日`, "success");
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
        if (window.showToast) showToast(`前月のデータから休日が見つかりませんでした`, "warning");
    }
};

function countOnSite(dateStr) {
    if (!state.shifts[dateStr]) return 0;
    // Iterate only active members to avoid counting deleted "ghost" members
    let count = 0;
    const list = getActiveMembers();
    list.forEach(m => {
        const s = state.shifts[dateStr][m.id];
        count += getShiftDays(s);
    });
    return count;
}
