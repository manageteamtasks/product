document.addEventListener('DOMContentLoaded', () => {
    const API_URL = 'https://script.google.com/macros/s/AKfycbxQrMCjdV5U1KxDa7n1fKreLzTuQMTj8S6ZYlxuEm-VwB_YT_c51O1BXjux76nGMInH/exec';
    const taskForm = document.getElementById('task-form');
    const taskList = document.getElementById('task-list');
    const taskInput = document.getElementById('task-input');
    const assignedInput = document.getElementById('assigned-input');
    const statusInput = document.getElementById('status-input');
    const assignedFilter = document.getElementById('assigned-filter');
    const loginModal = document.getElementById('login-modal');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const userInfo = document.getElementById('user-info');
    const logoutBtn = document.getElementById('logout-btn');
    const changePasswordBtn = document.getElementById('change-password-btn');
    const changePasswordModal = document.getElementById('change-password-modal');
    const changePasswordForm = document.getElementById('change-password-form');
    const changePasswordError = document.getElementById('change-password-error');
    const closeChangePassword = document.getElementById('close-change-password');
    let allTasks = [];
    let currentFilter = '';

    // --- Kanban Logic ---
    assignedFilter.addEventListener('change', () => {
        currentFilter = assignedFilter.value;
        renderTasks(allTasks);
    });

    taskForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const editId = taskForm.getAttribute('data-edit-id');
        const taskData = {
            ID: editId ? editId : `task-${new Date().getTime()}`,
            Task: taskInput.value,
            Assigned: assignedInput.value,
            Status: statusInput.value,
            MonthYear: document.getElementById('month-year-input').value
        };
        if (editId) {
            await handlePostRequest('updateTask', taskData);
            taskForm.removeAttribute('data-edit-id');
            taskForm.querySelector('button[type="submit"]').textContent = 'Add Task';
        } else {
            await handlePostRequest('addTask', taskData);
        }
        taskForm.reset();
        fetchTasks();
    });

    async function fetchTasks() {
        try {
            const response = await fetch(API_URL);
            if (!response.ok) throw new Error('Failed to fetch tasks');
            const tasks = await response.json();
            allTasks = tasks;
            renderTasks(tasks);
        } catch (error) {
            console.error('Error fetching tasks:', error);
            taskList.innerHTML = '<p>Error loading tasks. Please try again.</p>';
        }
    }

    function renderTasks(tasks) {
        let filtered = tasks;
        if (currentFilter) {
            filtered = tasks.filter(task => (task.Assigned || '') === currentFilter);
        }
        document.getElementById('lane-todo').innerHTML = '';
        document.getElementById('lane-inprogress').innerHTML = '';
        document.getElementById('lane-review').innerHTML = '';
        document.getElementById('lane-hold').innerHTML = '';
        document.getElementById('lane-done').innerHTML = '';
        if (filtered.length === 0) {
            document.getElementById('lane-todo').innerHTML = '<p>No tasks found. Add one above!</p>';
            return;
        }
        const cardColors = [
            '#fffbe6', '#e6fff9', '#e6f0ff', '#f3e6ff', '#ffe6f2', '#e6ffe6', '#fff0e6'
        ];
        const loggedInUser = localStorage.getItem('loggedInUser');
        const loggedInRole = localStorage.getItem('loggedInRole');
        filtered.forEach(task => {
            const taskItem = document.createElement('div');
            taskItem.className = 'task-item';
            const color = cardColors[Math.floor(Math.random() * cardColors.length)];
            taskItem.style.background = color;
            let monthYearDisplay = '';
            if (task.MonthYear) {
                const [year, month] = task.MonthYear.split('-');
                if (year && month) {
                    const date = new Date(year, month - 1);
                    const monthName = date.toLocaleString('default', { month: 'long' });
                    monthYearDisplay = `${monthName} ${year.slice(-2)}`;
                }
            }
            taskItem.innerHTML = `
                <div class="details">
                    <div class="task-name">${task.Task}</div>
                    <div class="task-assigned">${task.Assigned ? task.Assigned : ''}</div>
                    <div class="task-monthyear">${monthYearDisplay}</div>
                </div>
                <div class="actions">
                    <button class="edit-btn" data-id="${task.ID}" title="Edit Task">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2a2.828 2.828 0 0 1 4 4L7 21H3v-4L18 2z"/></svg>
                    </button>
                    ${loggedInRole === 'admin' ? `<button class="delete-btn" data-id="${task.ID}" title="Delete Task">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>` : ''}
                </div>
            `;
            let status = (task.Status || '').toLowerCase();
            let laneId = '';
            switch (status) {
                case 'to do': laneId = 'lane-todo'; break;
                case 'in progress': laneId = 'lane-inprogress'; break;
                case 'review': laneId = 'lane-review'; break;
                case 'hold': laneId = 'lane-hold'; break;
                case 'done': laneId = 'lane-done'; break;
                default: laneId = 'lane-todo'; break;
            }
            document.getElementById(laneId).appendChild(taskItem);
        });
        document.querySelectorAll('.edit-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const taskId = e.target.closest('button').dataset.id;
                const task = filtered.find(t => t.ID === taskId);
                if (task) {
                    taskInput.value = task.Task;
                    assignedInput.value = task.Assigned;
                    statusInput.value = task.Status;
                    document.getElementById('month-year-input').value = task.MonthYear || '';
                    taskForm.setAttribute('data-edit-id', task.ID);
                    taskForm.querySelector('button[type="submit"]').textContent = 'Update Task';
                }
            });
        });
        if (loggedInRole === 'admin') {
            document.querySelectorAll('.delete-btn').forEach(button => {
                button.addEventListener('click', async (e) => {
                    const taskId = e.target.dataset.id;
                    if (confirm('Are you sure you want to delete this task?')) {
                        await handlePostRequest('deleteTask', { ID: taskId });
                        fetchTasks();
                    }
                });
            });
        }
    }

    async function handlePostRequest(action, payload) {
        try {
            const response = await fetch(`${API_URL}?action=${action}`, {
                method: 'POST',
                body: JSON.stringify(payload),
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8',
                },
            });
            if (response.type !== 'redirect' && !response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to ${action}: ${errorText}`);
            }
            console.log(`${action} successful`);
        } catch (error) {
            console.error(`Error with ${action}:`, error);
        }
    }

    // --- Login Logic ---
    function showLogin(user) {
        if (user) {
            loginModal.style.display = 'none';
            userInfo.innerHTML = `<span class="user-icon">\
                <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='#6a8dff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='8' r='4'/><path d='M4 20c0-2.5 3.5-4 8-4s8 1.5 8 4'/></svg>\
            </span> <b>${user}</b>`;
            logoutBtn.style.display = 'block';
            changePasswordBtn && (changePasswordBtn.style.display = 'block');
            document.body.classList.remove('body-blur');
            fetchTasks();
        } else {
            loginModal.style.display = 'flex';
            userInfo.textContent = '';
            logoutBtn.style.display = 'none';
            changePasswordBtn && (changePasswordBtn.style.display = 'none');
            document.body.classList.add('body-blur');
        }
    }

    let loggedInUser = localStorage.getItem('loggedInUser');
    let loggedInRole = localStorage.getItem('loggedInRole');
    showLogin(loggedInUser);

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = document.getElementById('login-user').value;
        const password = document.getElementById('login-password').value;
        loginError.textContent = '';
        try {
            const response = await fetch(`${API_URL}?action=login`, {
                method: 'POST',
                body: JSON.stringify({ user, password }),
                headers: { 'Content-Type': 'text/plain;charset=utf-8' }
            });
            const result = await response.json();
            if (result.status === 'success') {
                localStorage.setItem('loggedInUser', user);
                localStorage.setItem('loggedInRole', result.data.role || '');
                loggedInRole = result.data.role || '';
                showLogin(user);
            } else {
                loginError.textContent = 'Invalid username or password';
            }
        } catch (err) {
            loginError.textContent = 'Login failed. Please try again.';
        }
    });

    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('loggedInUser');
        localStorage.removeItem('loggedInRole');
        loggedInRole = '';
        showLogin(null);
    });

    // Change Password logic
    changePasswordBtn.addEventListener('click', () => {
        changePasswordModal.style.display = 'flex';
        changePasswordError.textContent = '';
        document.getElementById('new-password').value = '';
    });
    closeChangePassword.addEventListener('click', () => {
        changePasswordModal.style.display = 'none';
    });
    changePasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPassword = document.getElementById('new-password').value;
        const user = localStorage.getItem('loggedInUser');
        changePasswordError.textContent = '';
        try {
            const response = await fetch(`${API_URL}?action=changePassword`, {
                method: 'POST',
                body: JSON.stringify({ user, newPassword }),
                headers: { 'Content-Type': 'text/plain;charset=utf-8' }
            });
            const result = await response.json();
            if (result.status === 'success') {
                changePasswordModal.style.display = 'none';
                alert('Password updated successfully!');
            } else {
                changePasswordError.textContent = 'Failed to update password.';
            }
        } catch (err) {
            changePasswordError.textContent = 'Error updating password.';
        }
    });
}); 