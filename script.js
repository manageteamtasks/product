document.addEventListener('DOMContentLoaded', () => {
    // IMPORTANT: Replace this URL with your new Google Apps Script deployment URL
    // After deploying the updated script, copy the new URL and replace this one
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
    
    // Debug: Check if assigned input exists
    console.log('Assigned input element found:', !!assignedInput);
    if (assignedInput) {
        console.log('Assigned input initial value:', assignedInput.value);
        console.log('Assigned input display style:', assignedInput.style.display);
    }
    
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

    // Function to generate next task number
    function generateNextTaskNumber(tasks) {
        let maxNumber = 0;
        
        tasks.forEach(task => {
            if (task.TaskNumber && task.TaskNumber.startsWith('SS-')) {
                const numberPart = task.TaskNumber.substring(3); // Remove 'SS-' prefix
                const number = parseInt(numberPart, 10);
                if (!isNaN(number) && number > maxNumber) {
                    maxNumber = number;
                }
            }
        });
        
        // If no existing task numbers found, start from 1
        return `SS-${maxNumber + 1}`;
    }

    // Helper function to ensure assigned input is set for non-admin users
    function ensureAssignedInputSet() {
        console.log('ensureAssignedInputSet called');
        console.log('loggedInRole:', loggedInRole);
        console.log('loggedInUser:', loggedInUser);
        console.log('assignedInput exists:', !!assignedInput);
        
        if (!assignedInput) {
            console.error('Assigned input element not found!');
            return;
        }
        
        if (loggedInRole !== 'admin') {
            console.log('Hiding assigned input for non-admin user:', loggedInUser);
            assignedInput.style.display = 'none';
            // Still set the value internally for form submission
            assignedInput.value = loggedInUser || '';
            console.log('Assigned input value set to:', assignedInput.value);
        } else {
            console.log('Admin user - assigned input visible and enabled');
            assignedInput.style.display = 'block';
            assignedInput.disabled = false;
            assignedInput.style.backgroundColor = '';
            assignedInput.style.cursor = '';
        }
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
            const authToken = localStorage.getItem('authToken');
            
            // Check if user is logged in
            if (!authToken) {
                console.log('No auth token found, redirecting to login');
                showLogin(null);
                return;
            }
            
            // Add cache-busting parameter to force fresh data
            const timestamp = new Date().getTime();
            let url = `${API_URL}?token=${encodeURIComponent(authToken)}&t=${timestamp}`;
            
            console.log('Refreshing tasks with URL:', url);
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: Failed to fetch tasks`);
            }
            
            const responseText = await response.text();
            let tasks;
            
            try {
                tasks = JSON.parse(responseText);
            } catch (parseError) {
                console.error('Failed to parse response as JSON:', parseError);
                console.error('Raw response text:', responseText);
                throw new Error('Invalid response format from server');
            }
            
            // Check if the response indicates an authentication error
            if (tasks.status === 'error' && tasks.message && 
                (tasks.message.includes('No valid authorization token provided') || 
                 tasks.message.includes('Invalid or expired token'))) {
                console.log('Authentication failed, redirecting to login');
                // Clear invalid token and show login
                localStorage.removeItem('authToken');
                localStorage.removeItem('loggedInUser');
                localStorage.removeItem('loggedInRole');
                loggedInUser = null;
                loggedInRole = '';
                showLogin(null);
                return;
            }
            
            allTasks = tasks;
            renderTasks(tasks);
        } catch (error) {
            console.error('Error refreshing tasks:', error);
            
            // If it's an authentication error, redirect to login
            if (error.message.includes('401') || error.message.includes('403') || 
                error.message.includes('No valid authorization token') || 
                error.message.includes('Invalid or expired token')) {
                console.log('Authentication error detected, redirecting to login');
                localStorage.removeItem('authToken');
                localStorage.removeItem('loggedInUser');
                localStorage.removeItem('loggedInRole');
                loggedInUser = null;
                loggedInRole = '';
                showLogin(null);
                return;
            }
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
        ensureAssignedInputSet();
        taskForm.removeAttribute('data-edit-id');
        taskForm.querySelector('button[type="submit"]').textContent = 'Add';
        cancelEditBtn.style.display = 'none';
    });

    taskForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const editId = taskForm.getAttribute('data-edit-id');
        
        // Ensure assigned input is set for non-admin users
        ensureAssignedInputSet();
        
        // Double-check: if it's a non-admin user, force set the assigned value
        if (loggedInRole !== 'admin') {
            assignedInput.value = loggedInUser;
            console.log('Forced assigned input to:', assignedInput.value);
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
            TaskNumber: editId ? (allTasks.find(t => t.ID === editId)?.TaskNumber || generateNextTaskNumber(allTasks)) : generateNextTaskNumber(allTasks),
            Task: taskInput.value,
            Assigned: assignedInput.value,
            Status: statusInput.value,
            MonthYear: excelMonthYear
        };
        
        console.log('Generated task number:', taskData.TaskNumber);
        console.log('Task data being sent:', taskData);
        console.log('Assigned value in taskData:', taskData.Assigned);
        
        if (editId) {
            try {
                await handlePostRequest('updateTask', taskData);
                taskForm.removeAttribute('data-edit-id');
                taskForm.querySelector('button[type="submit"]').textContent = 'Add';
                cancelEditBtn.style.display = 'none';
                taskForm.reset();
                setDefaultMonthYear();
                // Reset assigned input for non-admin users after form reset
                ensureAssignedInputSet();
                fetchTasks();
            } catch (error) {
                console.error('Failed to update task:', error);
                // Don't reset form or fetch tasks on error
                return;
            }
        } else {
            try {
                await handlePostRequest('addTask', taskData);
                taskForm.reset();
                setDefaultMonthYear();
                // Reset assigned input for non-admin users after form reset
                ensureAssignedInputSet();
                fetchTasks();
            } catch (error) {
                console.error('Failed to add task:', error);
                // Don't reset form or fetch tasks on error
                return;
            }
        }
    });

    async function fetchTasks() {
        try {
            const authToken = localStorage.getItem('authToken');
            
            // Check if user is logged in
            if (!authToken) {
                console.log('No auth token found, redirecting to login');
                showLogin(null);
                return;
            }
            
            let url = `${API_URL}?token=${encodeURIComponent(authToken)}`;
            console.log('Fetching tasks with URL:', url);
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: Failed to fetch tasks`);
            }
            
            const responseText = await response.text();
            let tasks;
            
            try {
                tasks = JSON.parse(responseText);
            } catch (parseError) {
                console.error('Failed to parse response as JSON:', parseError);
                console.error('Raw response text:', responseText);
                throw new Error('Invalid response format from server');
            }
            
            // Check if the response indicates an authentication error
            if (tasks.status === 'error' && tasks.message && 
                (tasks.message.includes('No valid authorization token provided') || 
                 tasks.message.includes('Invalid or expired token'))) {
                console.log('Authentication failed, redirecting to login');
                // Clear invalid token and show login
                localStorage.removeItem('authToken');
                localStorage.removeItem('loggedInUser');
                localStorage.removeItem('loggedInRole');
                loggedInUser = null;
                loggedInRole = '';
                showLogin(null);
                return;
            }
            
            console.log('Tasks received from backend:', tasks);
            allTasks = tasks;
            populateMonthYearFilter(tasks);
            renderTasks(tasks);
        } catch (error) {
            console.error('Error fetching tasks:', error);
            
            // If it's an authentication error, redirect to login
            if (error.message.includes('401') || error.message.includes('403') || 
                error.message.includes('No valid authorization token') || 
                error.message.includes('Invalid or expired token')) {
                console.log('Authentication error detected, redirecting to login');
                localStorage.removeItem('authToken');
                localStorage.removeItem('loggedInUser');
                localStorage.removeItem('loggedInRole');
                loggedInUser = null;
                loggedInRole = '';
                showLogin(null);
                return;
            }
            
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
                    monthYearDisplay = `${monthName}'${yearDisplay}`;
                }
            }
            taskItem.innerHTML = `
                ${task.TaskNumber && task.TaskNumber.startsWith('SS-') ? `<div class="task-number">${task.TaskNumber}</div>` : ''}
                <div class="details">
                    <div class="task-name">${task.Task}</div>
                    <div class="task-assigned">
                        <div class="assigned-line">
                            ${task.Assigned ? `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; padding-top: 2px;"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-2.5 3.5-4 8-4s8 1.5 8 4"/></svg>${task.Assigned}` : ''}
                        </div>
                        ${monthYearDisplay ? `<div class="task-monthyear">${monthYearDisplay}</div>` : ''}
                    </div>
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
                        assignedInput.style.display = 'block';
                        assignedInput.disabled = false;
                        assignedInput.style.backgroundColor = '';
                        assignedInput.style.cursor = '';
                    } else {
                        ensureAssignedInputSet();
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
            const authToken = localStorage.getItem('authToken');
            
            console.log(`Sending ${action} request`);
            console.log('Payload:', payload);
            console.log('Auth token:', authToken);
            
            // Use URL parameters for all actions to avoid CORS preflight
            let url = `${API_URL}?action=${action}`;
            
            // Add auth token as parameter if it exists
            if (authToken) {
                url += `&token=${encodeURIComponent(authToken)}`;
            }
            
            // Add payload data as URL parameters
            Object.keys(payload).forEach(key => {
                url += `&${encodeURIComponent(key)}=${encodeURIComponent(payload[key])}`;
            });
            
            console.log('Request URL:', url);
            
            const response = await fetch(url, {
                method: 'POST',
                // No headers to avoid CORS preflight
            });
            
            console.log('Response status:', response.status);
            console.log('Response ok:', response.ok);
            
            // Always try to get the response text first
            const responseText = await response.text();
            console.log('Response text length:', responseText.length);
            console.log('Response text:', responseText);
            
            // Check if response is empty or redirect
            if (!responseText || responseText.trim() === '') {
                throw new Error('Empty response from server');
            }
            
            let responseData;
            try {
                responseData = JSON.parse(responseText);
            } catch (parseError) {
                console.error('Failed to parse response as JSON:', parseError);
                console.error('Raw response text:', responseText);
                throw new Error(`Invalid response format: ${responseText.substring(0, 100)}...`);
            }
            
            // Check if the response indicates an error
            if (responseData.status === 'error') {
                console.error('API returned error:', responseData.message);
                
                // Check if it's an authentication error
                if (responseData.message && 
                    (responseData.message.includes('No valid authorization token provided') || 
                     responseData.message.includes('Invalid or expired token'))) {
                    console.log('Authentication error detected, redirecting to login');
                    // Clear invalid token and show login
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('loggedInUser');
                    localStorage.removeItem('loggedInRole');
                    loggedInUser = null;
                    loggedInRole = '';
                    showLogin(null);
                    return; // Don't throw error, just return
                }
                
                throw new Error(responseData.message || 'API returned an error');
            }
            
            // Check HTTP status codes
            if (response.status >= 400) {
                throw new Error(`HTTP ${response.status}: ${responseData.message || responseText}`);
            }
            
            console.log(`${action} successful:`, responseData);
            return responseData; // Return the response data
        } catch (error) {
            console.error(`Error with ${action}:`, error);
            console.error('Error stack:', error.stack);
            
            // Check if it's an authentication error
            if (error.message && 
                (error.message.includes('No valid authorization token provided') || 
                 error.message.includes('Invalid or expired token') ||
                 error.message.includes('401') ||
                 error.message.includes('403'))) {
                console.log('Authentication error detected, redirecting to login');
                // Clear invalid token and show login
                localStorage.removeItem('authToken');
                localStorage.removeItem('loggedInUser');
                localStorage.removeItem('loggedInRole');
                loggedInUser = null;
                loggedInRole = '';
                showLogin(null);
                return; // Don't throw error, just return
            }
            
            // Show error to user for non-authentication errors
            alert(`Error: ${error.message}`);
            throw error; // Re-throw to prevent further processing
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
                    assignedInput.value = loggedInUser;
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
            ensureAssignedInputSet();
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
    
    // Ensure assigned input is set for non-admin users on page load
    ensureAssignedInputSet();

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
        localStorage.removeItem('authToken');
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
            const result = await handlePostRequest('changePassword', { user, newPassword });
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
        
        console.log('Login attempt for user:', user);
        
        try {
            const loginData = { user, password };
            console.log('Sending login data:', loginData);
            
            const result = await handlePostRequest('login', loginData);
            
            console.log('Parsed login result:', result);
            
            if (result.status === 'success') {
                console.log('Login successful, setting localStorage');
                console.log('User:', user);
                console.log('Role from server:', result.data.role);
                console.log('Token from server:', result.data.token);
                
                localStorage.setItem('loggedInUser', user);
                localStorage.setItem('loggedInRole', result.data.role || '');
                localStorage.setItem('authToken', result.data.token || '');
                loggedInRole = result.data.role || '';
                loggedInUser = user; // Update the global variable immediately
                
                console.log('Stored loggedInRole:', loggedInRole);
                console.log('Stored loggedInUser:', localStorage.getItem('loggedInUser'));
                console.log('Updated loggedInUser variable:', loggedInUser);
                
                showLogin(user);
            } else {
                console.log('Login failed:', result.message);
                loginError.textContent = result.message || 'Invalid username or password';
            }
        } catch (err) {
            console.error('Login error:', err);
            loginError.textContent = 'Login failed. Please try again.';
        }
    });
});
