/**
 * State Management
 */

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
    fixed: {},
    // Conditions: [{ type: 'TOGETHER'|'SEPARATE', m1: id, m2: id }]
    conditions: [],
    // Last Holiday Date for each member per month: "YYYY-MM" -> { memberId: "YYYY-MM-DD" }
    lastHolidays: {},
    // Daily notes/targets
    dailyTargets: {},
    dailyNotes: {}
};

// UI State
let viewMode = 'calendar'; // 'calendar' | 'timeline'
const uiState = { focusedMemberId: null };

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
            if (typeof state.settings.showOffMembers === 'undefined') {
                state.settings.showOffMembers = true;
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
