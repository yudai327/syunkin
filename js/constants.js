/**
 * Constants
 */

const DAYS_JP = ['日', '月', '火', '水', '木', '金', '土'];
const STORAGE_KEY = 'shunkin_v1_data';

// Shift type icons - centralized for consistency
const SHIFT_ICONS = {
    ON_SITE: '🏢',
    TRIP: '✈️',
    HALF_AM: '☀️',
    HALF_PM: '🌙',
    OFF: '❌'
};

const SHIFT_TYPES = {
    ON_SITE: 'ON_SITE',
    TRIP: 'TRIP',
    HALF_AM: 'HALF_AM',
    HALF_PM: 'HALF_PM',
    OFF: 'OFF'
};

const SHIFT_LABELS = {
    ON_SITE: '出勤',
    TRIP: '出張',
    HALF_AM: '午前休',
    HALF_PM: '午後休',
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
