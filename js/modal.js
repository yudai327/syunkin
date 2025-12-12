/**
 * Modal Logic (replaces alert, confirm, prompt, and forms)
 */

window.setupModal = function () {
    // Inject modal HTML into body if not present
    if (!document.getElementById('custom-modal-overlay')) {
        const overlay = document.createElement('div');
        overlay.id = 'custom-modal-overlay';
        overlay.className = 'custom-modal-overlay';
        overlay.style.display = 'none';

        overlay.innerHTML = `
            <div class="custom-modal-content">
                <div class="custom-modal-header" id="custom-modal-title"></div>
                <div class="custom-modal-body">
                    <p id="custom-modal-message"></p>
                    <input type="text" id="custom-modal-input" class="custom-modal-input" style="display:none;" />
                    <div id="custom-modal-form-container"></div>
                </div>
                <div class="custom-modal-footer">
                    <button id="custom-modal-cancel" class="btn btn-secondary">キャンセル</button>
                    <button id="custom-modal-ok" class="btn btn-primary">OK</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
    }
}

// Internal promise handlers
let modalResolve = null;

function openModal(options) {
    return new Promise((resolve) => {
        modalResolve = resolve;

        const overlay = document.getElementById('custom-modal-overlay');
        const titleEl = document.getElementById('custom-modal-title');
        const msgEl = document.getElementById('custom-modal-message');
        const inputEl = document.getElementById('custom-modal-input');
        const formContainer = document.getElementById('custom-modal-form-container');
        const btnCancel = document.getElementById('custom-modal-cancel');
        const btnOk = document.getElementById('custom-modal-ok');

        if (!overlay) return resolve(null); // Safety

        // Reset state
        inputEl.value = '';
        inputEl.style.display = 'none';
        btnCancel.style.display = 'none';
        formContainer.innerHTML = ''; // Clear form
        formContainer.style.display = 'none';

        // Set content
        titleEl.textContent = options.title || '通知';
        msgEl.textContent = options.message || '';

        // Type specific setup
        if (options.type === 'prompt') {
            inputEl.style.display = 'block';
            inputEl.value = options.defaultValue || '';
            btnCancel.style.display = 'inline-flex';
            setTimeout(() => inputEl.focus(), 50);
        } else if (options.type === 'confirm') {
            btnCancel.style.display = 'inline-flex';
        } else if (options.type === 'form') {
            btnCancel.style.display = 'inline-flex';
            formContainer.style.display = 'flex';
            formContainer.style.flexDirection = 'column';
            formContainer.style.gap = '12px';
            formContainer.style.marginTop = '12px';

            options.fields.forEach(field => {
                const wrapper = document.createElement('div');
                wrapper.style.display = 'flex';
                wrapper.style.flexDirection = 'column';
                wrapper.style.gap = '4px';

                const label = document.createElement('label');
                label.textContent = field.label;
                label.style.fontSize = '0.85rem';
                label.style.color = '#64748b';
                label.style.fontWeight = '500';

                const input = document.createElement('input');
                input.type = field.type || 'text';
                input.value = (field.value !== undefined && field.value !== null) ? field.value : '';
                input.className = 'custom-modal-input';
                input.style.marginTop = '0';
                input.dataset.key = field.key;
                if (field.placeholder) input.placeholder = field.placeholder;

                wrapper.appendChild(label);
                wrapper.appendChild(input);
                formContainer.appendChild(wrapper);
            });
        }

        // Event Handlers
        const handleOk = () => {
            if (options.type === 'prompt') {
                closeModal();
                resolve(inputEl.value);
            } else if (options.type === 'form') {
                const results = {};
                const formInputs = formContainer.querySelectorAll('input');
                formInputs.forEach(inp => {
                    results[inp.dataset.key] = inp.value;
                });
                closeModal();
                resolve(results);
            } else {
                closeModal();
                resolve(true);
            }
        };

        const handleCancel = () => {
            closeModal();
            if (options.type === 'prompt' || options.type === 'form') {
                resolve(null);
            } else {
                resolve(false);
            }
        };

        // Remove old listeners to avoid stacking if we were re-using elements incorrectly (though we recreate promise every time)
        // Ideally we should cloneNode to strip listeners, but onclick override is simple enough here
        btnOk.onclick = handleOk;
        btnCancel.onclick = handleCancel;

        // Enter key for prompt
        inputEl.onkeydown = (e) => {
            if (e.key === 'Enter') handleOk();
            if (e.key === 'Escape') handleCancel();
        };

        overlay.style.display = 'flex';
    });
}

function closeModal() {
    const overlay = document.getElementById('custom-modal-overlay');
    if (overlay) overlay.style.display = 'none';
    modalResolve = null;
}

// Public API
window.showAlert = async function (message, title = '通知') {
    return openModal({ type: 'alert', message, title });
};

window.showConfirm = async function (message, title = '確認') {
    return openModal({ type: 'confirm', message, title });
};

window.showPrompt = async function (message, defaultValue = '', title = '入力') {
    return openModal({ type: 'prompt', message, defaultValue, title });
};

window.showForm = async function (title, message, fields) {
    return openModal({ type: 'form', title, message, fields });
};

// Initialize on load
document.addEventListener('DOMContentLoaded', window.setupModal);
