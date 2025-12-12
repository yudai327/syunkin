/**
 * Utilities
 */

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

function formatDate(d) {
    const year = d.getFullYear();
    const month = ('0' + (d.getMonth() + 1)).slice(-2);
    const day = ('0' + d.getDate()).slice(-2);
    return `${year}-${month}-${day}`;
}

// Get the number of work days for a shift type
function getShiftDays(shiftType) {
    if (shiftType === 'ON_SITE' || shiftType === 'TRIP') return 1;
    if (shiftType === 'HALF_AM' || shiftType === 'HALF_PM') return 0.5;
    return 0; // OFF or null
}

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
