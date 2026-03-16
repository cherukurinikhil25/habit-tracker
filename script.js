document.addEventListener('DOMContentLoaded', () => {
    // --- State ---
    let currentDate = new Date(); // Current viewing month
    let habits = JSON.parse(localStorage.getItem('habits')) || [
        { id: generateId(), name: 'Drink Water' },
        { id: generateId(), name: 'Gym' },
        { id: generateId(), name: 'Read Book' },
        { id: generateId(), name: 'Meditation' }
    ];
    // completions object: { habitId: ["YYYY-MM-DD", ...] }
    let completions = JSON.parse(localStorage.getItem('completions')) || {};

    let editingHabitId = null;
    let chartInstance = null;

    // --- DOM Elements ---
    const themeToggleBtn = document.getElementById('theme-toggle');
    const moonIcon = document.getElementById('moon-icon');
    const sunIcon = document.getElementById('sun-icon');

    const prevMonthBtn = document.getElementById('prev-month');
    const nextMonthBtn = document.getElementById('next-month');
    const currentMonthDisplay = document.getElementById('current-month-display');

    const addHabitForm = document.getElementById('add-habit-form');
    const newHabitInput = document.getElementById('new-habit-input');

    const trackerGrid = document.getElementById('tracker-grid');

    const totalCompletedEl = document.getElementById('total-completed');
    const completionRateEl = document.getElementById('completion-rate');

    const modal = document.getElementById('habit-modal');
    const editHabitInput = document.getElementById('edit-habit-input');
    const saveHabitBtn = document.getElementById('save-habit-btn');
    const deleteHabitBtn = document.getElementById('delete-habit-btn');
    const cancelModalBtn = document.getElementById('cancel-modal-btn');

    // --- Initialization ---
    initTheme();
    renderApp();

    // --- Event Listeners ---
    themeToggleBtn.addEventListener('click', toggleTheme);

    prevMonthBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderApp();
    });

    nextMonthBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderApp();
    });

    addHabitForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = newHabitInput.value.trim();
        if (name) {
            addHabit(name);
            newHabitInput.value = '';
        }
    });

    cancelModalBtn.addEventListener('click', closeModal);
    saveHabitBtn.addEventListener('click', saveEditedHabit);
    deleteHabitBtn.addEventListener('click', deleteHabit);

    // Stop propagation on modal content to allow clicking outside to close
    document.querySelector('.modal-content').addEventListener('click', e => e.stopPropagation());
    modal.addEventListener('click', closeModal);

    // --- Core Functions ---

    function generateId() {
        return Math.random().toString(36).substr(2, 9);
    }

    function saveData() {
        localStorage.setItem('habits', JSON.stringify(habits));
        localStorage.setItem('completions', JSON.stringify(completions));
    }

    function getDaysInMonth(year, month) {
        return new Date(year, month + 1, 0).getDate();
    }

    function formatDate(year, month, day) {
        const m = String(month + 1).padStart(2, '0');
        const d = String(day).padStart(2, '0');
        return `${year}-${m}-${d}`;
    }

    function renderApp() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const daysInMonth = getDaysInMonth(year, month);

        // Update Header
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        currentMonthDisplay.textContent = `${monthNames[month]} ${year}`;

        renderGrid(year, month, daysInMonth);
        updateStats(year, month, daysInMonth);
        renderChart(year, month, daysInMonth);
    }

    function renderGrid(year, month, daysInMonth) {
        trackerGrid.innerHTML = '';

        // CSS Grid columns: 1 for names, + days
        trackerGrid.style.gridTemplateColumns = `200px repeat(${daysInMonth}, minmax(35px, 1fr))`;

        // Top Left empty header cell
        const cornerCell = document.createElement('div');
        cornerCell.className = 'grid-cell header-cell';
        cornerCell.textContent = 'Habit / Day';
        trackerGrid.appendChild(cornerCell);

        // Top row (Days)
        for (let day = 1; day <= daysInMonth; day++) {
            const dayCell = document.createElement('div');
            dayCell.className = 'grid-cell header-cell';
            dayCell.textContent = day;
            trackerGrid.appendChild(dayCell);
        }

        // Rows for each habit
        habits.forEach(habit => {
            // Habit Name cell
            const nameCell = document.createElement('div');
            nameCell.className = 'grid-cell habit-name-cell';
            nameCell.textContent = habit.name;
            nameCell.title = "Click to edit";
            nameCell.addEventListener('click', () => openModal(habit));
            trackerGrid.appendChild(nameCell);

            // Days cells
            // Migrate array to object if necessary
            if (Array.isArray(completions[habit.id])) {
                const oldArray = completions[habit.id];
                completions[habit.id] = {};
                oldArray.forEach(d => completions[habit.id][d] = 'completed');
                saveData(); // save the migrated structure
            }

            const habitCompletions = completions[habit.id] || {};

            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = formatDate(year, month, day);
                const status = habitCompletions[dateStr];

                const cell = document.createElement('div');
                cell.className = `grid-cell day-cell ${status ? status : ''}`;
                cell.dataset.habitId = habit.id;
                cell.dataset.date = dateStr;

                cell.addEventListener('click', function () {
                    toggleCompletion(habit.id, dateStr, this);
                });

                trackerGrid.appendChild(cell);
            }
        });
    }

    function toggleCompletion(habitId, dateStr, cellElement) {
        if (!completions[habitId]) {
            completions[habitId] = {};
        }

        const currentState = completions[habitId][dateStr];

        cellElement.classList.remove('completed', 'failed');

        if (!currentState) {
            // Blank -> Completed
            completions[habitId][dateStr] = 'completed';
            cellElement.classList.add('completed');
        } else if (currentState === 'completed') {
            // Completed -> Failed
            completions[habitId][dateStr] = 'failed';
            cellElement.classList.add('failed');
        } else {
            // Failed -> Blank
            delete completions[habitId][dateStr];
        }

        // Create a small pop effect manually just in case
        cellElement.style.transform = 'scale(0.9)';
        setTimeout(() => cellElement.style.transform = 'scale(1)', 150);

        saveData();

        // Update stats and chart dynamically without full rerender
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        updateStats(year, month, daysInMonth);
        renderChart(year, month, daysInMonth);
    }

    function getMonthStats(year, month, daysInMonth) {
        let todayCompleted = 0;
        const totalPossible = habits.length * daysInMonth; // Monthly total possible for completion rate
        const dailyScores = Array(daysInMonth).fill(0);

        const todayStr = formatDate(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());

        habits.forEach(habit => {
            const habitCompletions = completions[habit.id] || {};

            // Check today's completion
            if (habitCompletions[todayStr] === 'completed') {
                todayCompleted++;
            }

            Object.keys(habitCompletions).forEach(dateStr => {
                const status = habitCompletions[dateStr];
                if (status === 'completed') {
                    const [cYear, cMonth, cDay] = dateStr.split('-');
                    if (parseInt(cYear) === year && parseInt(cMonth) - 1 === month) {
                        // monthCompleted++; (Removed as it's not needed for display anymore, but kept dailyScores logic)
                        dailyScores[parseInt(cDay) - 1]++;
                    }
                }
            });
        });

        // Calculate monthly completion rate
        let monthlyCompletedCount = dailyScores.reduce((a, b) => a + b, 0);

        return { todayCompleted, monthlyCompletedCount, totalPossible, dailyScores };
    }

    function updateStats(year, month, daysInMonth) {
        if (habits.length === 0) {
            totalCompletedEl.textContent = '0';
            completionRateEl.textContent = '0%';
            return;
        }

        const stats = getMonthStats(year, month, daysInMonth);
        totalCompletedEl.textContent = stats.todayCompleted;

        const rate = stats.totalPossible > 0 ? Math.round((stats.monthlyCompletedCount / stats.totalPossible) * 100) : 0;
        completionRateEl.textContent = `${rate}%`;
    }

    function renderChart(year, month, daysInMonth) {
        const stats = getMonthStats(year, month, daysInMonth);
        const labels = Array.from({ length: daysInMonth }, (_, i) => i + 1);

        const canvas = document.getElementById('score-chart');
        if (!canvas) return; // Prevent error if canvas isn't ready
        const ctx = canvas.getContext('2d');

        // Get theme colors for chart
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const textColor = isDark ? '#94a3b8' : '#64748b';
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(148, 163, 184, 0.1)';
        const primaryColor = isDark ? '#818cf8' : '#6366f1';
        
        // Create Gradient for chart fill
        let gradient = ctx.createLinearGradient(0, 0, 0, 350);
        if (isDark) {
            gradient.addColorStop(0, 'rgba(52, 211, 153, 0.5)'); // success-color based
            gradient.addColorStop(1, 'rgba(52, 211, 153, 0.0)');
        } else {
            gradient.addColorStop(0, 'rgba(16, 185, 129, 0.4)'); // success-color based
            gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
        }
        
        if (chartInstance) {
            chartInstance.destroy();
        }
        
        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Habits Completed',
                    data: stats.dailyScores,
                    borderColor: primaryColor,
                    backgroundColor: gradient,
                    borderWidth: 3,
                    pointBackgroundColor: isDark ? '#1e293b' : '#ffffff',
                    pointBorderColor: primaryColor,
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointHoverBackgroundColor: primaryColor,
                    pointHoverBorderColor: '#ffffff',
                    fill: true,
                    tension: 0.4 // smoother curves
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                        titleColor: isDark ? '#f8fafc' : '#0f172a',
                        bodyColor: isDark ? '#f8fafc' : '#0f172a',
                        borderColor: gridColor,
                        borderWidth: 1,
                        padding: 12,
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                return `Completed: ${context.parsed.y}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: Math.max(habits.length, 1), // Max is number of habits
                        ticks: {
                            stepSize: 1,
                            color: textColor
                        },
                        grid: { color: gridColor }
                    },
                    x: {
                        ticks: { color: textColor },
                        grid: { display: false }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
    }

    // --- Habit Management ---

    function addHabit(name) {
        const newHabit = { id: generateId(), name: name };
        habits.push(newHabit);
        saveData();
        renderApp(); // Full rerender to add the new row
    }

    function openModal(habit) {
        editingHabitId = habit.id;
        editHabitInput.value = habit.name;
        modal.classList.add('active');
        editHabitInput.focus();
    }

    function closeModal() {
        modal.classList.remove('active');
        editingHabitId = null;
    }

    function saveEditedHabit() {
        const newName = editHabitInput.value.trim();
        if (newName && editingHabitId) {
            const habit = habits.find(h => h.id === editingHabitId);
            if (habit) {
                habit.name = newName;
                saveData();
                renderApp();
            }
        }
        closeModal();
    }

    function deleteHabit() {
        if (editingHabitId) {
            habits = habits.filter(h => h.id !== editingHabitId);
            // Clean up completions
            delete completions[editingHabitId];
            saveData();
            renderApp();
        }
        closeModal();
    }

    // --- Theme Management ---

    function initTheme() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.setAttribute('data-theme', 'dark');
            moonIcon.style.display = 'none';
            sunIcon.style.display = 'block';
        }
    }

    function toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        if (currentTheme === 'dark') {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('theme', 'light');
            moonIcon.style.display = 'block';
            sunIcon.style.display = 'none';
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
            moonIcon.style.display = 'none';
            sunIcon.style.display = 'block';
        }

        // Re-render chart for colors
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        renderChart(year, month, daysInMonth);
    }
});
