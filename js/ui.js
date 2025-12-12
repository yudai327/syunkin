/**
 * UI Rendering and Interaction
 */

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

    // Buttons
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
    btnDeleteTeam: document.getElementById('btn-delete-team'),

    // View Toggle
    btnViewCal: document.getElementById('btn-view-cal'),
    btnViewTimeline: document.getElementById('btn-view-timeline')
};

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

    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
window.showToast = showToast;

// --- Context Menus ---
function showContextMenu(e, dateStr) {
    const existingMenu = document.getElementById('context-menu');
    if (existingMenu) existingMenu.remove();

    const menu = document.createElement('div');
    menu.id = 'context-menu';
    menu.className = 'context-menu';
    menu.style.position = 'fixed';
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';
    menu.style.zIndex = '1000';
    menu.dataset.x = e.clientX;
    menu.dataset.y = e.clientY;
    menu.dataset.dateStr = dateStr;

    const header = document.createElement('div');
    header.className = 'context-menu-header';
    header.textContent = 'メンバーを選択';
    menu.appendChild(header);

    const activeMembers = getActiveMembers();

    // Filter members based on setting
    const visibleMembers = state.settings.showOffMembers
        ? activeMembers
        : activeMembers.filter(m => {
            const shift = getShift(dateStr, m.id);
            return shift !== 'OFF';
        });

    visibleMembers.forEach(m => {
        const shift = getShift(dateStr, m.id);
        const isLocked = isFixed(dateStr, m.id);

        const item = document.createElement('div');
        item.className = 'context-menu-item';

        const currentIcon = SHIFT_ICONS[shift] || '';
        item.innerHTML = `${currentIcon} ${m.name}`;
        if (isLocked) {
            item.style.backgroundColor = '#fee2e2';
        }

        item.onclick = () => {
            showShiftTypeSelector(e, dateStr, m.id, menu);
        };
        menu.appendChild(item);
    });

    document.body.appendChild(menu);

    // Adjust position if off-screen
    const rect = menu.getBoundingClientRect();
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;

    let top = e.clientY;
    let left = e.clientX;

    // Vertical adjustment
    if (top + rect.height > winHeight) {
        top = winHeight - rect.height - 10;
    }
    if (top < 0) {
        top = 10;
        if (rect.height > winHeight) {
            menu.style.maxHeight = (winHeight - 20) + 'px';
            menu.style.overflowY = 'auto';
        }
    }

    // Horizontal adjustment
    if (left + rect.width > winWidth) {
        left = winWidth - rect.width - 10;
    }
    if (left < 0) left = 10;

    menu.style.top = top + 'px';
    menu.style.left = left + 'px';

    const closeMenu = (event) => {
        if (!menu.contains(event.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
}
window.showContextMenu = showContextMenu;

function showShiftTypeSelector(e, dateStr, memberId, parentMenu) {
    if (parentMenu) {
        parentMenu.remove();
    } else {
        const existing = document.getElementById('context-menu');
        if (existing) existing.remove();
    }

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

    const header = document.createElement('div');
    header.className = 'context-menu-header';
    header.textContent = `${member.name} - シフト選択`;
    menu.appendChild(header);

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

        item.innerHTML = `${st.icon} ${st.label}${isCurrent ? ' ✓' : ''}`;

        if (isCurrentLocked) {
            item.style.backgroundColor = '#fee2e2';
        } else if (isCurrent) {
            item.style.backgroundColor = '#e0f2fe';
        }

        item.onclick = () => {
            // Set shift and simple auto-lock
            setShift(dateStr, memberId, st.type);

            // Auto-lock: Ensure fixed object exists and set value
            if (!state.fixed[dateStr]) state.fixed[dateStr] = {};
            state.fixed[dateStr][memberId] = st.type;

            saveState();
            render();
            menu.remove();
        };
        menu.appendChild(item);
    });

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

    // Adjust position if off-screen
    const rect = menu.getBoundingClientRect();
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;

    let top = e.clientY;
    let left = e.clientX;

    // Vertical adjustment
    if (top + rect.height > winHeight) {
        top = winHeight - rect.height - 10;
    }
    if (top < 0) {
        top = 10;
        if (rect.height > winHeight) {
            menu.style.maxHeight = (winHeight - 20) + 'px';
            menu.style.overflowY = 'auto';
        }
    }

    // Horizontal adjustment
    if (left + rect.width > winWidth) {
        left = winWidth - rect.width - 10;
    }
    if (left < 0) left = 10;

    menu.style.top = top + 'px';
    menu.style.left = left + 'px';

    const closeMenu = (event) => {
        if (!menu.contains(event.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
}
window.showShiftTypeSelector = showShiftTypeSelector;

// --- Rendering Functions ---

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

    if (els.btnEditTeam) els.btnEditTeam.disabled = (current === 'ALL');
    if (els.btnDeleteTeam) els.btnDeleteTeam.disabled = (current === 'ALL');
}
window.renderTeams = renderTeams;

function renderSidebar() {
    if (!els.memberList) return;
    els.memberList.innerHTML = '';

    const list = getActiveMembers();
    const getTeamIndex = (tid) => state.teams.findIndex(t => t.id === tid);
    list.sort((a, b) => {
        const idxA = getTeamIndex(a.teamId);
        const idxB = getTeamIndex(b.teamId);
        if (idxA !== idxB) return idxA - idxB;
        return 0;
    });

    list.forEach(m => {
        const div = document.createElement('div');
        div.className = `member-item ${uiState.focusedMemberId === m.id ? 'focused' : ''}`;
        div.style.display = 'flex';
        div.style.flexDirection = 'column';
        div.style.gap = '8px';
        div.style.padding = '8px';
        div.style.marginBottom = '4px';
        div.style.borderRadius = '6px';
        div.style.border = '1px solid var(--border)';
        div.style.cursor = 'pointer';

        const teamId = m.teamId || (state.teams[0] ? state.teams[0].id : null);
        if (teamId) {
            const hex = getTeamColor(teamId);
            let r = 0, g = 0, b = 0;
            if (hex.length === 7) {
                r = parseInt(hex.slice(1, 3), 16);
                g = parseInt(hex.slice(3, 5), 16);
                b = parseInt(hex.slice(5, 7), 16);
            }
            div.style.setProperty('background-color', `rgba(${r}, ${g}, ${b}, 0.15)`, 'important');
            div.style.borderLeft = `4px solid ${hex}`;
            div.style.borderColor = 'var(--border)';
        }

        div.onclick = (e) => {
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
    if (window.lucide) lucide.createIcons();
}
window.renderSidebar = renderSidebar;

function renderCalendar() {
    if (!els.calendarGrid) return;
    els.calendarGrid.innerHTML = '';
    const dates = getDaysInMonth(state.settings.yearMonth);

    let firstDay = dates[0].getDay();
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

        cell.onclick = (e) => showContextMenu(e, dateStr);

        if (!isWorkDay(d)) {
            cell.style.backgroundColor = '#f8fafc';
        } else if (state.dailyTargets && state.dailyTargets[dateStr] !== undefined && state.dailyTargets[dateStr] == 0) {
            cell.style.backgroundColor = '#f1f5f9'; // Gray out if target is 0
        }

        const dayHeader = document.createElement('div');
        dayHeader.className = 'cal-cell-header';
        dayHeader.onclick = (e) => { e.stopPropagation(); handleHeaderClick(dateStr); };
        dayHeader.title = "左クリック:設定";
        dayHeader.style.cursor = 'pointer';

        const isToday = formatDate(new Date()) === dateStr;
        const weekDay = DAYS_JP[d.getDay()];
        const note = state.dailyNotes && state.dailyNotes[dateStr];
        const target = state.dailyTargets && state.dailyTargets[dateStr];

        dayHeader.innerHTML = `
            <div style="display:flex; flex-direction:column; width:100%;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div style="display:flex; align-items:baseline; gap:6px; flex-wrap:wrap;">
                        <span class="cal-date ${isToday ? 'today' : ''}">
                            ${d.getDate()} <small>(${weekDay})</small>
                        </span>
                        ${note ? `<span style="font-size:0.75rem; color:#d97706; font-weight:bold;">${note}</span>` : ''}
                    </div>
                    ${(target !== undefined && target !== null && target !== '') ? `<span style="font-size:0.7rem; background:#e0f2fe; color:#0369a1; padding:1px 3px; border-radius:3px; white-space:nowrap; margin-left:4px;">必要${target}</span>` : ''}
                </div>
            </div>
            `;

        const onSiteCount = countOnSite(dateStr);
        if (onSiteCount > 0) {
            const countBadge = document.createElement('span');
            countBadge.className = 'cal-count';
            countBadge.textContent = onSiteCount;
            if (target && onSiteCount !== parseInt(target)) {
                countBadge.style.background = '#ef4444';
                countBadge.style.color = 'white';
            }
            dayHeader.appendChild(countBadge);
        }

        cell.appendChild(dayHeader);

        const contentDiv = document.createElement('div');
        contentDiv.className = 'cal-cell-content';

        const getTeamIndex = (tid) => state.teams.findIndex(t => t.id === tid);
        const list = getActiveMembers();
        list.sort((a, b) => {
            const tIdxA = getTeamIndex(a.teamId);
            const tIdxB = getTeamIndex(b.teamId);
            if (tIdxA !== tIdxB) return tIdxA - tIdxB;
            return 0;
        });

        list.forEach(m => {
            const shift = getShift(dateStr, m.id);
            // If setting false, hide OFF members
            if (!state.settings.showOffMembers && (!shift || shift === 'OFF')) return;
            // If setting true, always show (unless no shift definition, but usually getShift returns OFF or something)
            // Actually getShift defaults to 'OFF' if undefined.
            // If showOffMembers is TRUE, we want to show OFF.
            // Wait, existing logic was: if (!shift || shift === 'OFF') return;
            // This means it was ALWAYS hiding OFF members.
            // The user said "Toggle ON/OFF".
            // So default (old behavior) was HIDING OFF members?
            // Let's check the code: line 496 says `if (!shift || shift === 'OFF') return;`
            // Yes, it was hiding them.
            // So if showOffMembers is TRUE, we should NOT return here.

            if (!state.settings.showOffMembers && (!shift || shift === 'OFF')) return;

            if (uiState.focusedMemberId && uiState.focusedMemberId !== m.id) return;

            const chip = document.createElement('div');
            chip.className = `shift-chip type-${shift.toLowerCase().replace('_', '-')}`;
            chip.draggable = true;
            chip.textContent = m.name.substring(0, 3);

            const tColor = getTeamColor(m.teamId);
            chip.style.borderLeft = `3px solid ${tColor}`;

            if (m.teamId && shift === 'ON_SITE') {
                const hex = tColor;
                const r = parseInt(hex.slice(1, 3), 16);
                const g = parseInt(hex.slice(3, 5), 16);
                const b = parseInt(hex.slice(5, 7), 16);
                chip.style.backgroundColor = `rgba(${r}, ${g}, ${b}, 0.15)`;
            }

            if (isFixed(dateStr, m.id)) {
                chip.classList.add('locked');
            }

            chip.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                showShiftTypeSelector(e, dateStr, m.id);
            };
            chip.ondragstart = (e) => handleDragStart(e, m.id, dateStr);
            chip.ondragend = () => chip.classList.remove('is-dragging');

            contentDiv.appendChild(chip);
        });

        cell.addEventListener('contextmenu', (e) => {
            if (e.target === cell || e.target === contentDiv) {
                e.preventDefault();
                showContextMenu(e, dateStr);
            }
        });

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
window.renderCalendar = renderCalendar;

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
                title="左クリック:設定">
                <div style="display:flex; flex-direction:column; justify-content:space-between; height:100%;">
                    <div>
                        <div class="day-num">${dayNum}</div>
                        <div class="day-week">${dayWeek}</div>
                    </div>
                    <div>
                        ${note ? '<div class="marker note"></div>' : ''}
                        ${(target !== undefined && target !== null && target !== '') ? '<div class="marker target"></div>' : ''}
                    </div>
                </div>
            </th>
        `;
    });

    html += `
            <th class="timeline-header-cell" style="width:40px; min-width:40px;">出勤</th>
            <th class="timeline-header-cell" style="width:40px; min-width:40px;">休日</th>
            </tr></thead><tbody>
    `;

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
        let headerBgStyle = 'background-color: #f1f5f9;';
        if (group.team.id !== 'orphan') {
            const hex = teamColor;
            if (hex.length === 7) {
                const r = parseInt(hex.slice(1, 3), 16);
                const g = parseInt(hex.slice(3, 5), 16);
                const b = parseInt(hex.slice(5, 7), 16);
                headerBgStyle = `background-color: rgba(${r}, ${g}, ${b}, 0.25);`;
            }
        }

        if (index > 0) {
            html += `<tr style="height: 20px; border: none; background: #f1f5f9;"><td colspan="${dates.length + 3}" style="border:none;"></td></tr>`;
        }

        html += `
            <tr class="timeline-team-header" style="font-weight: bold;">
                <td class="timeline-member-cell" style="border-left: 4px solid ${teamColor}; padding-left: 8px; ${headerBgStyle}">
                    ▼ ${group.team.name}
                </td>
                <td colspan="${dates.length + 2}" style="${headerBgStyle}"></td> 
            </tr>
        `;

        group.members.forEach(m => {
            const isFocused = uiState.focusedMemberId === m.id;
            const isDimmed = uiState.focusedMemberId && uiState.focusedMemberId !== m.id;

            let rowClass = 'timeline-row';
            if (isFocused) rowClass += ' focused';
            if (isDimmed) rowClass += ' dimmed';

            html += `<tr class="${rowClass}">`;

            let cellBgStyle = '';
            if (m.teamId) {
                const hex = getTeamColor(m.teamId);
                if (hex.length === 7) {
                    const r = parseInt(hex.slice(1, 3), 16);
                    const g = parseInt(hex.slice(3, 5), 16);
                    const b = parseInt(hex.slice(5, 7), 16);
                    cellBgStyle = `background-color: rgba(${r}, ${g}, ${b}, 0.15);`;
                }
            } else {
                cellBgStyle = 'background-color: white;';
            }

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
                const isTargetZero = state.dailyTargets && state.dailyTargets[dateStr] !== undefined && state.dailyTargets[dateStr] == 0;

                let cellClass = 'timeline-cell';
                if (!workDay || isTargetZero) cellClass += ' non-work';
                if (locked) cellClass += ' locked-cell';

                html += `<td class="${cellClass}" 
                             onclick="showShiftTypeSelector(event, '${dateStr}', '${m.id}')">`;

                if (shift && shift !== 'OFF') {
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

            let workDays = 0, daysOff = 0;
            dates.forEach(d => {
                const s = getShift(formatDate(d), m.id);
                workDays += getShiftDays(s);
                if (s === 'OFF' || !s) daysOff++;
            });

            html += `
                <td class="timeline-stats-cell" style="text-align:center; font-weight:bold; color:var(--primary);">${workDays}</td>
                <td class="timeline-stats-cell" style="text-align:center; color:var(--text-muted);">${daysOff}</td>
            `;
            html += `</tr>`;
        });

        // Team Summary
        html += `<tr class="timeline-team-summary" style="background-color: #f8fafc; border-top: 1px dashed #cbd5e1;">
            <td class="timeline-footer-label" style="text-align:right; font-size:0.75rem; color:var(--text-muted);">
                ${group.team.name} 計
            </td>`;

        let groupTotalWork = 0, groupTotalOff = 0;
        dates.forEach(d => {
            const dateStr = formatDate(d);
            let teamCount = 0;
            group.members.forEach(m => teamCount += getShiftDays(getShift(dateStr, m.id)));
            groupTotalWork += teamCount;
            html += `<td style="text-align:center; font-size:0.75rem; font-weight:bold; color:var(--text-muted);">${teamCount}</td>`;
        });

        group.members.forEach(m => {
            dates.forEach(d => {
                const s = getShift(formatDate(d), m.id);
                if (s === 'OFF' || !s) groupTotalOff++;
            });
        });

        html += `<td style="text-align:center; font-weight:bold;">${groupTotalWork}</td>`;
        html += `<td style="text-align:center; color:var(--text-muted);">${groupTotalOff}</td>`;
        html += `</tr>`;
    });

    // Footers
    html += `</tbody><tfoot><tr style="height: 20px; border: none; background: #f1f5f9;"><td colspan="${dates.length + 3}" style="border:none;"></td></tr>`;

    // On-Site Count
    html += `<tr><td class="timeline-footer-label">出勤人数</td>`;
    dates.forEach(d => {
        const dateStr = formatDate(d);
        const onSiteCount = countOnSite(dateStr);
        const target = state.dailyTargets && state.dailyTargets[dateStr];
        let styleClass = 'timeline-footer-cell';
        if (target && onSiteCount !== parseInt(target)) styleClass += ' warn';
        html += `<td class="${styleClass}">${onSiteCount}</td>`;
    });
    html += `<td class="timeline-footer-cell"></td><td class="timeline-footer-cell"></td></tr>`;

    // Off Count
    html += `<tr><td class="timeline-footer-label">休日/他</td>`;
    dates.forEach(d => {
        const dateStr = formatDate(d);
        const onSiteCount = countOnSite(dateStr);
        const total = state.members.length;
        html += `<td class="timeline-footer-cell" style="color:#64748b;">${total - onSiteCount}</td>`;
    });
    html += `<td class="timeline-footer-cell"></td><td class="timeline-footer-cell"></td></tr>`;

    // Variance
    if (Object.keys(state.dailyTargets || {}).length > 0) {
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

    html += `</tfoot></table></div>`;
    container.innerHTML = html;
}
window.renderTimeline = renderTimeline;


function updateStats() {
    const dates = getDaysInMonth(state.settings.yearMonth);
    const workDays = dates.filter(isWorkDay).length;
    els.statWorkDays.textContent = `${workDays} 日`;

    let totalAssigned = 0;
    Object.values(state.shifts).forEach(dayMap => {
        Object.values(dayMap).forEach(status => {
            if (status === 'ON_SITE' || status === 'TRIP') {
                totalAssigned++;
            }
        });
    });
    els.statTotalSlots.textContent = totalAssigned;
}

function updateUIInputs() {
    if (!state.settings.yearMonth) return;
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
window.updateUIInputs = updateUIInputs;

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
window.renderView = renderView;

// --- Drag & Drop ---
let dragSource = null;

function handleDragStart(e, memberId, fromDate) {
    dragSource = { memberId, fromDate };
    e.dataTransfer.effectAllowed = 'copyMove';
    e.dataTransfer.setData('text/plain', JSON.stringify({ memberId, fromDate }));
    setTimeout(() => e.target.classList.add('is-dragging'), 0);
}
window.handleDragStart = handleDragStart;

function handleDrop(e, toDate) {
    e.preventDefault();
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));

    if (!dragSource) return;
    const { memberId, fromDate } = dragSource;

    if (state.fixed[toDate] && state.fixed[toDate][memberId]) {
        window.showAlert("移動先が固定されています。");
        dragSource = null;
        return;
    }

    let status = 'ON_SITE';
    if (fromDate) {
        status = state.shifts[fromDate][memberId] || 'ON_SITE';
        if (state.fixed[fromDate] && state.fixed[fromDate][memberId]) {
            window.showAlert("移動元が固定されています。");
            dragSource = null;
            return;
        }
        delete state.shifts[fromDate][memberId];

        if (fromDate === toDate) {
            setShift(toDate, memberId, status);
            render(); dragSource = null; return;
        }
    }

    setShift(toDate, memberId, status);
    render();
    saveState();
    dragSource = null;
}
window.handleDrop = handleDrop;

function handleTimelineDrop(e, toDate, toMemberId) {
    e.preventDefault();
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));

    if (!dragSource) return;
    const { memberId: srcMemberId, fromDate } = dragSource;

    const destMemberId = toMemberId;

    if (state.fixed[toDate] && state.fixed[toDate][destMemberId]) {
        window.showAlert("移動先が固定されています。");
        dragSource = null;
        return;
    }

    let status = 'ON_SITE';
    if (fromDate) {
        status = state.shifts[fromDate][srcMemberId] || 'ON_SITE';
        if (state.fixed[fromDate] && state.fixed[fromDate][srcMemberId]) {
            window.showAlert("移動元が固定されています。");
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

// Main Render Alias
function render() {
    if (typeof viewMode !== 'undefined') {
        renderView();
    } else {
        renderSidebar();
        renderTeams();
        renderCalendar();
        updateStats();
        updateUIInputs();
    }
}
window.render = render;
