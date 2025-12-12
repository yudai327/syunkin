/**
 * Initialization and Global Event Listeners
 */

function init() {
    loadState();
    if (window.updateUIInputs) updateUIInputs();

    // Attach Events
    if (els.monthInput) els.monthInput.addEventListener('change', (e) => updateSetting('yearMonth', e.target.value));

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

    if (els.btnGenerate) els.btnGenerate.addEventListener('click', () => {
        console.log("Generate button clicked");
        generateSchedule();
    });
    if (els.btnReset) els.btnReset.addEventListener('click', resetSchedule);
    if (els.btnPrint) els.btnPrint.addEventListener('click', () => {
        if (window.preparePrint) preparePrint(viewMode);
        window.print();
    });
    if (els.btnAddMember) els.btnAddMember.addEventListener('click', addMember);

    // Team Events
    if (els.teamSelect) els.teamSelect.addEventListener('change', (e) => switchTeam(e.target.value));
    if (els.btnAddTeam) els.btnAddTeam.addEventListener('click', addTeam);
    if (els.btnEditTeam) els.btnEditTeam.addEventListener('click', editTeam);
    if (els.btnDeleteTeam) els.btnDeleteTeam.addEventListener('click', deleteTeam);

    // View Mode Toggle
    if (els.btnViewCal) els.btnViewCal.addEventListener('click', () => setViewMode('calendar'));
    if (els.btnViewTimeline) els.btnViewTimeline.addEventListener('click', () => setViewMode('timeline'));

    // Export / Import
    if (els.btnExport) els.btnExport.addEventListener('click', exportData);
    if (els.btnImport) els.btnImport.addEventListener('click', () => els.fileImport.click());
    if (els.fileImport) els.fileImport.addEventListener('change', importData);

    // Sidebar Toggle
    const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
    if (btnToggleSidebar) {
        btnToggleSidebar.addEventListener('click', () => {
            const sidebar = document.querySelector('.sidebar');
            if (sidebar) sidebar.classList.toggle('collapsed');
        });
    }

    // Toggle OFF members visibility
    const btnToggleOff = document.getElementById('btn-toggle-off-members');
    if (btnToggleOff) {
        // Update icon based on initial state
        const icon = btnToggleOff.querySelector('i');
        if (state.settings.showOffMembers) {
            btnToggleOff.classList.add('active'); // Optional styling
            if (icon) icon.setAttribute('data-lucide', 'eye');
        } else {
            if (icon) icon.setAttribute('data-lucide', 'eye-off');
        }

        btnToggleOff.addEventListener('click', () => {
            state.settings.showOffMembers = !state.settings.showOffMembers;
            // Update icon
            if (state.settings.showOffMembers) {
                if (icon) icon.setAttribute('data-lucide', 'eye');
            } else {
                if (icon) icon.setAttribute('data-lucide', 'eye-off');
            }
            if (window.lucide) lucide.createIcons();

            saveState();
            render();
        });
    }

    const btnHeaderMenu = document.getElementById('btn-header-menu');
    const headerControls = document.querySelector('.header-controls');
    if (btnHeaderMenu && headerControls) {
        btnHeaderMenu.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent immediate closing
            headerControls.classList.toggle('mobile-open');
        });

        // Close menu when clicking inside (e.g. on a button)
        headerControls.addEventListener('click', (e) => {
            // If clicked element is likely an action (button, link, label), close menu
            if (e.target.closest('button') || e.target.tagName === 'A' || e.target.tagName === 'LABEL') {
                headerControls.classList.remove('mobile-open');
            }
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (headerControls.classList.contains('mobile-open') &&
                !headerControls.contains(e.target) &&
                !btnHeaderMenu.contains(e.target)) {
                headerControls.classList.remove('mobile-open');
            }
        });
    }

    // Help Modal
    initHelpModal();

    if (window.render) render();
    // Default mode
    setViewMode('calendar');
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

function setViewMode(mode) {
    viewMode = mode;
    if (els.btnViewCal) {
        els.btnViewCal.classList.toggle('btn-primary', mode === 'calendar');
        els.btnViewCal.classList.toggle('btn-secondary', mode !== 'calendar');
    }
    if (els.btnViewTimeline) {
        els.btnViewTimeline.classList.toggle('btn-primary', mode === 'timeline');
        els.btnViewTimeline.classList.toggle('btn-secondary', mode !== 'timeline');
    }
    if (window.render) render();
}
window.setViewMode = setViewMode;

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
window.exportData = exportData;

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const parsed = JSON.parse(e.target.result);
            // Basic validation
            if (!parsed.members || !parsed.settings) {
                window.showAlert("無効なファイル形式です", "エラー");
                return;
            }
            // Remove version key if present before setting state
            const { version, ...cleanData } = parsed;

            state = cleanData;

            // KEY FIX: Run migration logic to support legacy files or missing team data
            if (window.migrateAndValidateState) migrateAndValidateState();

            saveState();
            if (window.render) render();
            // Update inputs
            if (window.updateUIInputs) updateUIInputs();
            if (window.updateUIInputs) updateUIInputs();
            window.showToast("インポートしました", "success");
        } catch (err) {
            console.error(err);
            window.showAlert("読み込みに失敗しました", "エラー");
        }
    };
    reader.readAsText(file);
    // Reset input
    event.target.value = '';
}
window.importData = importData;

// Start init on load
window.addEventListener('DOMContentLoaded', init);
