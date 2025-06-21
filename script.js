document.addEventListener('DOMContentLoaded', () => {
    const API_URL = 'https://script.google.com/macros/s/AKfycbxQrMCjdV5U1KxDa7n1fKreLzTuQMTj8S6ZYlxuEm-VwB_YT_c51O1BXjux76nGMInH/exec';
    const taskForm = document.getElementById('task-form');
    const taskList = document.getElementById('task-list');
    const taskInput = document.getElementById('task-input');
    const assignedInput = document.getElementById('assigned-input');
    const statusInput = document.getElementById('status-input');
    const assignedFilter = document.getElementById('assigned-filter');
    const monthYearFilter = document.getElementById('month-year-filter');
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
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const userMenuBtn = document.getElementById('user-menu-btn');
    const userMenuDropdown = document.getElementById('user-menu-dropdown');
    const userMenuText = document.getElementById('user-menu-text');
    let allTasks = [];
    let currentFilter = '';
    let currentMonthYearFilter = '';

    // Helper function to normalize month-year values for comparison
    function normalizeMonthYear(monthYearValue) {
        if (!monthYearValue) return '';
        
        if (monthYearValue.includes('/')) {
            // Excel format: DD/MM/YYYY -> YYYY-MM
            const parts = monthYearValue.split('/');
            if (parts.length === 3) {
                const month = parts[1];
                const year = parts[2];
                return `${year}-${month.padStart(2, '0')}`;
            }
        } else if (monthYearValue.includes('T') && monthYearValue.includes('Z')) {
            // ISO date format: 2025-01-04T18:30:00.000Z -> YYYY-MM
            const date = new Date(monthYearValue);
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            return `${year}-${month}`;
        } else if (monthYearValue.includes('-')) {
            // Already in YYYY-MM format
            return monthYearValue;
        }
        
        return '';
    }

    // Function to populate month-year filter options
    function populateMonthYearFilter(tasks) {
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        
        // Get current month and year
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = (now.getMonth() + 1).toString().padStart(2, '0');
        const currentMonthYear = `${currentYear}-${currentMonth}`;
        
        // Get unique month-year combinations from tasks
        const uniqueMonthYears = new Set();
        tasks.forEach(task => {
            const normalized = normalizeMonthYear(task.MonthYear);
            if (normalized) {
                uniqueMonthYears.add(normalized);
            }
        });
        
        // Clear existing options except "All"
        const monthYearFilter = document.getElementById('month-year-filter');
        monthYearFilter.innerHTML = '<option value="">All</option>';
        
        // Add options for each unique month-year
        Array.from(uniqueMonthYears).sort().forEach(monthYear => {
            const [year, month] = monthYear.split('-');
            const monthName = monthNames[parseInt(month) - 1];
            const option = document.createElement('option');
            option.value = monthYear;
            option.textContent = `${monthName} ${year}`;
            monthYearFilter.appendChild(option);
        });
        
        // Set current month as default if it exists in the options
        if (uniqueMonthYears.has(currentMonthYear)) {
            monthYearFilter.value = currentMonthYear;
            currentMonthYearFilter = currentMonthYear;
        }
    }

    // Function to set default month-year value
    function setDefaultMonthYear() {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = (now.getMonth() + 1).toString().padStart(2, '0');
        const currentMonthYear = `${currentYear}-${currentMonth}`;
        document.getElementById('month-year-input').value = currentMonthYear;
    }

    // --- Kanban Logic ---
    assignedFilter.addEventListener('change', () => {
        currentFilter = assignedFilter.value;
        renderTasks(allTasks);
    });

    monthYearFilter.addEventListener('change', () => {
        currentMonthYearFilter = monthYearFilter.value;
        renderTasks(allTasks);
    });

    // Refresh button functionality
    const refreshBtn = document.getElementById('refresh-btn');
    refreshBtn.addEventListener('click', async () => {
        // Add visual feedback
        refreshBtn.style.transform = 'rotate(360deg)';
        refreshBtn.style.transition = 'transform 0.5s ease';
        
        try {
            // Add cache-busting parameter to force fresh data
            const timestamp = new Date().getTime();
            const response = await fetch(`${API_URL}?t=${timestamp}`);
            if (!response.ok) throw new Error('Failed to fetch tasks');
            const tasks = await response.json();
            allTasks = tasks;
            renderTasks(tasks);
        } catch (error) {
            console.error('Error refreshing tasks:', error);
        } finally {
            // Reset button animation
            setTimeout(() => {
                refreshBtn.style.transform = 'rotate(0deg)';
            }, 500);
        }
    });

    // Cancel edit functionality
    cancelEditBtn.addEventListener('click', () => {
        taskForm.reset();
        setDefaultMonthYear();
        taskForm.removeAttribute('data-edit-id');
        taskForm.querySelector('button[type="submit"]').textContent = 'Add';
        cancelEditBtn.style.display = 'none';
    });

    taskForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const editId = taskForm.getAttribute('data-edit-id');
        
        // Ensure assigned input is set for non-admin users
        if (loggedInRole !== 'admin' && assignedInput) {
            assignedInput.value = loggedInUser;
        }
        
        // Convert month-year input to Excel-friendly format
        const monthYearInput = document.getElementById('month-year-input').value;
        let excelMonthYear = monthYearInput;
        if (monthYearInput) {
            // Convert YYYY-MM to DD/MM/YYYY format for Excel
            const [year, month] = monthYearInput.split('-');
            if (year && month) {
                excelMonthYear = `05/${month}/${year}`;
            }
        }
        
        const taskData = {
            ID: editId ? editId : `task-${new Date().getTime()}`,
            Task: taskInput.value,
            Assigned: assignedInput.value,
            Status: statusInput.value,
            MonthYear: excelMonthYear
        };
        if (editId) {
            await handlePostRequest('updateTask', taskData);
            taskForm.removeAttribute('data-edit-id');
            taskForm.querySelector('button[type="submit"]').textContent = 'Add';
            cancelEditBtn.style.display = 'none';
        } else {
            await handlePostRequest('addTask', taskData);
        }
        taskForm.reset();
        setDefaultMonthYear();
        // Reset assigned input for non-admin users after form reset
        if (loggedInRole !== 'admin' && assignedInput) {
            assignedInput.value = loggedInUser;
        }
        fetchTasks();
    });

    async function fetchTasks() {
        try {
            const response = await fetch(API_URL);
            if (!response.ok) throw new Error('Failed to fetch tasks');
            const tasks = await response.json();
            allTasks = tasks;
            populateMonthYearFilter(tasks);
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
        if (currentMonthYearFilter) {
            filtered = filtered.filter(task => normalizeMonthYear(task.MonthYear) === currentMonthYearFilter);
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
            '#faf0e6', '#fff8dc', '#f5f5dc', '#ffe4e1', '#e6e6fa', '#fdf5e6', '#fffacd'
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
                // Handle both YYYY-MM format and Excel DD/MM/YYYY format
                let year, month;
                if (task.MonthYear.includes('/')) {
                    // Excel format: DD/MM/YYYY
                    const parts = task.MonthYear.split('/');
                    if (parts.length === 3) {
                        month = parseInt(parts[1], 10);
                        year = parseInt(parts[2], 10);
                    }
                } else if (task.MonthYear.includes('-')) {
                    // Original format: YYYY-MM
                    const [yearStr, monthStr] = task.MonthYear.split('-');
                    year = parseInt(yearStr, 10);
                    month = parseInt(monthStr, 10);
                }
                
                if (year && month) {
                    // Use month names array to avoid timezone issues completely
                    const monthNames = [
                        'January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'
                    ];
                    const monthName = monthNames[month - 1];
                    const yearDisplay = year.toString().slice(-2);
                    monthYearDisplay = `${monthName} ${yearDisplay}`;
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
                    
                    // Set assigned input based on user role
                    if (loggedInRole === 'admin') {
                        assignedInput.value = task.Assigned;
                    } else {
                        assignedInput.value = loggedInUser;
                    }
                    
                    statusInput.value = task.Status;
                    
                    // Convert Excel date format back to YYYY-MM for the input field
                    let monthYearValue = task.MonthYear || '';
                    
                    if (monthYearValue.includes('/')) {
                        // Excel format: DD/MM/YYYY -> YYYY-MM
                        const parts = monthYearValue.split('/');
                        if (parts.length === 3) {
                            const day = parts[0];
                            const month = parts[1];
                            const year = parts[2];
                            monthYearValue = `${year}-${month.padStart(2, '0')}`;
                        }
                    } else if (monthYearValue.includes('T') && monthYearValue.includes('Z')) {
                        // ISO date format: 2025-01-04T18:30:00.000Z -> YYYY-MM
                        const date = new Date(monthYearValue);
                        const year = date.getFullYear();
                        const month = (date.getMonth() + 1).toString().padStart(2, '0');
                        monthYearValue = `${year}-${month}`;
                    }
                    
                    document.getElementById('month-year-input').value = monthYearValue;
                    
                    taskForm.setAttribute('data-edit-id', task.ID);
                    taskForm.querySelector('button[type="submit"]').textContent = 'Update';
                    cancelEditBtn.style.display = 'inline-block';
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
            userMenuText.textContent = user;
            userMenuBtn.style.display = 'flex';
            
            // Enable/disable month-year filter based on user role
            const monthYearFilter = document.getElementById('month-year-filter');
            const monthYearFilterLabel = document.querySelector('label[for="month-year-filter"]');
            const monthYearInput = document.getElementById('month-year-input');
            const assignedFilter = document.getElementById('assigned-filter');
            const assignedFilterLabel = document.querySelector('label[for="assigned-filter"]');
            const assignedInput = document.getElementById('assigned-input');
            const statusInput = document.getElementById('status-input');
            
            if (loggedInRole === 'admin') {
                if (monthYearFilter) {
                    monthYearFilter.style.display = 'block';
                    monthYearFilter.disabled = false;
                    monthYearFilter.style.opacity = '1';
                    monthYearFilter.style.cursor = 'pointer';
                    monthYearFilter.title = 'Filter by month and year';
                }
                if (monthYearFilterLabel) {
                    monthYearFilterLabel.style.display = 'block';
                }
                if (monthYearInput) {
                    monthYearInput.style.display = 'block';
                    monthYearInput.disabled = false;
                }
                if (assignedFilter) {
                    assignedFilter.style.display = 'block';
                    assignedFilter.disabled = false;
                    assignedFilter.style.opacity = '1';
                    assignedFilter.style.cursor = 'pointer';
                }
                if (assignedFilterLabel) {
                    assignedFilterLabel.style.display = 'block';
                }
                if (assignedInput) {
                    assignedInput.style.display = 'block';
                    assignedInput.disabled = false;
                }
                // Show "Done" option for admin users
                if (statusInput) {
                    const doneOption = statusInput.querySelector('option[value="Done"]');
                    if (doneOption) {
                        doneOption.style.display = 'block';
                    }
                }
            } else {
                if (monthYearFilter) {
                    monthYearFilter.style.display = 'none';
                    monthYearFilter.disabled = true;
                    monthYearFilter.style.opacity = '0.5';
                    monthYearFilter.style.cursor = 'not-allowed';
                    monthYearFilter.title = 'Month filter - Admin only';
                    // Reset to current month for non-admin users
                    const now = new Date();
                    const currentYear = now.getFullYear();
                    const currentMonth = (now.getMonth() + 1).toString().padStart(2, '0');
                    const currentMonthYear = `${currentYear}-${currentMonth}`;
                    monthYearFilter.value = currentMonthYear;
                    currentMonthYearFilter = currentMonthYear;
                }
                if (monthYearFilterLabel) {
                    monthYearFilterLabel.style.display = 'none';
                }
                if (monthYearInput) {
                    monthYearInput.style.display = 'none';
                    monthYearInput.disabled = true;
                    // Set to current month for non-admin users
                    const now = new Date();
                    const currentYear = now.getFullYear();
                    const currentMonth = (now.getMonth() + 1).toString().padStart(2, '0');
                    const currentMonthYear = `${currentYear}-${currentMonth}`;
                    monthYearInput.value = currentMonthYear;
                }
                if (assignedFilter) {
                    assignedFilter.style.display = 'none';
                    assignedFilter.disabled = true;
                    assignedFilter.style.opacity = '0.5';
                    assignedFilter.style.cursor = 'not-allowed';
                    // Set assigned filter to current user's name
                    assignedFilter.value = user;
                    currentFilter = user;
                }
                if (assignedFilterLabel) {
                    assignedFilterLabel.style.display = 'none';
                }
                if (assignedInput) {
                    assignedInput.style.display = 'none';
                    assignedInput.disabled = true;
                    // Set assigned input to current user's name
                    assignedInput.value = user;
                }
                // Hide "Done" option for non-admin users
                if (statusInput) {
                    const doneOption = statusInput.querySelector('option[value="Done"]');
                    if (doneOption) {
                        doneOption.style.display = 'none';
                    }
                    // If current status is "Done", change it to "To Do"
                    if (statusInput.value === 'Done') {
                        statusInput.value = 'To Do';
                    }
                }
            }
            
            document.body.classList.remove('body-blur');
            fetchTasks();
        } else {
            loginModal.style.display = 'flex';
            userMenuText.textContent = '';
            userMenuBtn.style.display = 'none';
            userMenuDropdown.classList.remove('show');
            document.body.classList.add('body-blur');
        }
    }

    let loggedInUser = localStorage.getItem('loggedInUser');
    let loggedInRole = localStorage.getItem('loggedInRole');
    showLogin(loggedInUser);

    // Set default month-year value on page load
    setDefaultMonthYear();

    // User menu functionality
    userMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        userMenuDropdown.classList.toggle('show');
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!userMenuBtn.contains(e.target) && !userMenuDropdown.contains(e.target)) {
            userMenuDropdown.classList.remove('show');
        }
    });

    // Close menu when pressing Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            userMenuDropdown.classList.remove('show');
        }
    });

    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('loggedInUser');
        localStorage.removeItem('loggedInRole');
        loggedInRole = '';
        userMenuDropdown.classList.remove('show');
        showLogin(null);
    });

    // Change Password logic
    changePasswordBtn.addEventListener('click', () => {
        changePasswordModal.style.display = 'flex';
        changePasswordError.textContent = '';
        document.getElementById('new-password').value = '';
        userMenuDropdown.classList.remove('show');
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
});
