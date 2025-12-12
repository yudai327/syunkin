/**
 * Print Logic
 */

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
window.preparePrint = preparePrint;

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
    // table.appendChild(tfoot); // Already appended above
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
