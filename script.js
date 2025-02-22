/*******************************************************
 * script.js
 * Полный код, который объединяет функционал:
 *  - Переключение тем, sidebar, секций
 *  - «Главный экран» лаборатории и переключение «Тест / Задание»
 *  - Конструктор теста + предметы/авторы
 *  - Конструктор задания + предметы/авторы
 *  - Чат, генерация, и т.д.
 ******************************************************/

// Например, базовый адрес API, если нужно
const API_BASE_URL = 'https://aitalim.kz';

// Функция для отображения ошибок (всплывающее уведомление)
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: #ff4444;
        color: white;
        padding: 15px 20px;
        border-radius: 4px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        z-index: 1000;
    `;
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);

    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

// Функция для отображения ответов (для теста ИЛИ для заданий)
function updateAnswersDisplay(answersObj, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let html = '';
    for (const blockName in answersObj) {
        if (!Object.prototype.hasOwnProperty.call(answersObj, blockName)) continue;
        html += `<div class="answer-block">`;
        html += `<h3>${blockName}</h3>`;

        const blockData = answersObj[blockName];
        if (Array.isArray(blockData)) {
            if (blockData.length > 0 && Array.isArray(blockData[0])) {
                // Массив массивов
                blockData.forEach((subArray, index) => {
                    html += `<div class="answer-row"><strong>${index + 1}.</strong>`;
                    html += `<ol start="1">`;
                    subArray.forEach(item => {
                        html += `<li>${item}</li>`;
                    });
                    html += `</ol></div>`;
                });
            } else {
                // Простой массив строк
                html += `<ol start="1">`;
                blockData.forEach(item => {
                    html += `<li>${item}</li>`;
                });
                html += `</ol>`;
            }
        } else if (typeof blockData === 'string') {
            html += `<p>${blockData}</p>`;
        }
        html += `</div>`;
    }
    container.innerHTML = html;
}

// При загрузке DOM
document.addEventListener('DOMContentLoaded', async function() {
    // ------------------------------------------------
    // 0) Убираем "preload" после двух кадров (если нужно)
    // ------------------------------------------------
    document.body.classList.add('preload');
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            document.body.classList.remove('preload');
        });
    });

    // ------------------------------------------------
    // 1) Ссылки на основные элементы
    // ------------------------------------------------
    const menuToggle = document.querySelector('.menu-toggle');
    const themeToggle = document.querySelector('.theme-toggle');
    const icons = document.querySelectorAll('.icon');
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.section');

    // Профиль
    const logoutButton = document.querySelector('.profile-menu-item.logout');

    // -------- Лаборатория: «домашний» экран (главное меню внутри лаб) --------
    const labHomeContent = document.querySelector('.lab-home-content');
    const testCard = document.querySelector('.card-test');
    const taskCard = document.querySelector('.card-task');
    const homeworkCard = document.querySelector('.card-homework');
    const manualCard = document.querySelector('.card-manual');

    // -------- Контейнеры: Тест, Задание --------
    const labContainerTest = document.querySelector('.lab-container');       // Тест
    const labContainerTasks = document.querySelector('.lab-container-tasks'); // Задание

    // Тест (элементы)
    const documentTitleTest = document.querySelector('.document-title'); 
    const generateBtnTest = document.querySelector('.generate-btn');
    const workspaceMaterialTest = document.querySelector('.workspace-input');
    const workspaceAnswersAreaTest = document.getElementById('answersDisplay');
    const aiCommentsAreaTest = document.getElementById('ai-comments');
    const chatInputTest = document.querySelector('.chat-input');
    const sendButtonTest = document.querySelector('.send-button');

    // Задание (элементы)
    const documentTitleTasks = document.querySelector('.document-title-tasks');
    const generateBtnTask = document.querySelector('.generate-btn-task');
    const workspaceMaterialTask = document.querySelector('.workspace-input-tasks');
    const workspaceAnswersAreaTask = document.getElementById('answersDisplayTasks');
    const aiCommentsAreaTask = document.getElementById('ai-comments-tasks');
    const chatInputTask = document.querySelector('.chat-input-tasks');
    const sendButtonTask = document.querySelector('.send-button-tasks');

    // ------------------------------------------------
    // 2) Сайдбар (развёртывание / сворачивание)
    // ------------------------------------------------
    const savedSidebarState = localStorage.getItem('sidebarExpanded') === 'true';
    if (savedSidebarState) {
        document.body.classList.add('expanded');
    }
    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            document.body.classList.toggle('expanded');
            const isExpandedNow = document.body.classList.contains('expanded');
            localStorage.setItem('sidebarExpanded', isExpandedNow);
            saveAppState();
        });
    }

    // ------------------------------------------------
    // 3) Тёмная/светлая тема
    // ------------------------------------------------
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
    }
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark-theme');
            const currentTheme = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
            localStorage.setItem('theme', currentTheme);
        });
    }

    // ------------------------------------------------
    // 4) Переключение секций (иконки + navItems)
    // ------------------------------------------------
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            if (!item.getAttribute('data-section')) return;

            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            const targetId = item.getAttribute('data-section');
            showSection(targetId);
        });
    });

    icons.forEach(icon => {
        icon.addEventListener('click', function() {
            const prevActive = document.querySelector('.icon.active');
            const sectionId = this.dataset.section;

            if (prevActive !== this) {
                if (prevActive) prevActive.classList.remove('active');
                this.classList.add('active');
                showSection(sectionId);
            }
        });
    });

    function showSection(sectionId) {
        const targetSection = document.getElementById(sectionId);
        if (!targetSection) return;

        // Скрываем предыдущую активную
        const currentSection = document.querySelector('.section.active');
        if (currentSection && currentSection !== targetSection) {
            currentSection.style.opacity = '0';
            setTimeout(() => {
                currentSection.classList.remove('active');
                targetSection.classList.add('active');
                requestAnimationFrame(() => {
                    targetSection.style.opacity = '1';
                });
            }, 300);
        } else {
            // Если не было активной, просто сразу активируем
            targetSection.classList.add('active');
            targetSection.style.opacity = '1';
        }
        updateURL(sectionId);
        saveAppState();
    }

    // ------------------------------------------------
    // 5) URL: updateURL + popstate
    // ------------------------------------------------
    const pathMap = {
        'section-home': '/playground/home',
        'section-lab': '/playground/lab',
        'section-tasks': '/playground/homework',
        'section-students': '/playground/classes',
        'section-journal': '/playground/journal'
    };

    function updateURL(sectionId) {
        if (pathMap[sectionId]) {
            const newPath = pathMap[sectionId];
            history.pushState({ section: sectionId }, '', newPath);
        } else {
            history.pushState({ section: sectionId }, '', '/');
        }
    }

    window.addEventListener('popstate', (event) => {
        if (event.state && event.state.section) {
            showSection(event.state.section);
        }
    });

    // ------------------------------------------------
    // 6) Авторизация, профиль, logout
    // ------------------------------------------------
    if (logoutButton) {
        logoutButton.addEventListener('click', function(e) {
            e.preventDefault();
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login.html';
        });
    }

    function updateProfileInfo() {
        const userDataString = localStorage.getItem('user');
        if (userDataString) {
            try {
                const userData = JSON.parse(userDataString);
                const profileName = document.getElementById('profileName');
                const profileEmail = document.getElementById('profileEmail');
                
                let fullName = '';
                if (userData.firstName && userData.lastName) {
                    fullName = `${userData.firstName} ${userData.lastName}`;
                } else if (userData.firstName) {
                    fullName = userData.firstName;
                } else if (userData.email) {
                    fullName = userData.email.split('@')[0];
                }
                if (profileName) profileName.textContent = fullName;
                if (profileEmail) profileEmail.textContent = userData.email;
            } catch (error) {
                console.error('Ошибка при обработке userData:', error);
            }
        }
    }
    updateProfileInfo();

    // ------------------------------------------------
    // 7) Сохранение / Восстановление состояния
    // ------------------------------------------------
    function saveAppState() {
        const currentSection = document.querySelector('.section.active');
        const currentNavItem = document.querySelector('.nav-item.active');
        const state = {
            expanded: document.body.classList.contains('expanded'),
            activeSection: currentSection ? currentSection.id : 'section-home',
            activeNavItem: currentNavItem ? currentNavItem.getAttribute('data-section') : 'section-home',
            currentPath: window.location.pathname,
            lastSavedTime: Date.now()
        };
        localStorage.setItem('appState', JSON.stringify(state));
    }

    function restoreAppState() {
        const saved = localStorage.getItem('appState');
        if (saved) {
            const state = JSON.parse(saved);
            if (state.expanded) {
                document.body.classList.add('expanded');
            } else {
                document.body.classList.remove('expanded');
            }
            sections.forEach(section => {
                section.classList.remove('active');
                section.style.opacity = '0';
            });
            if (state.activeSection) {
                const target = document.getElementById(state.activeSection);
                if (target) {
                    target.classList.add('active');
                    target.style.opacity = '1';
                }
            }
            if (state.activeNavItem) {
                navItems.forEach(item => item.classList.remove('active'));
                const foundNav = document.querySelector(`.nav-item[data-section="${state.activeNavItem}"]`);
                if (foundNav) foundNav.classList.add('active');
            }
            icons.forEach(icon => {
                icon.classList.remove('active');
                if (icon.getAttribute('data-section') === state.activeSection) {
                    icon.classList.add('active');
                }
            });
        } else {
            // Если state нет, показываем по умолчанию home (пустой)
            showSection('section-home');
        }
    }
    restoreAppState();

    // ------------------------------------------------
    // 8) Переключатель языка (Translator) (пример, если нужно)
    // ------------------------------------------------
    // Здесь ваш код, если используете translator.js

    // ------------------------------------------------
    // 9) Логика «Лаборатория» — переключение между «домашним экраном» и «Тест/Задание»
    // ------------------------------------------------
    // Когда пользователь кликает по карточке «Тест»
    if (testCard && labHomeContent && labContainerTest && labContainerTasks) {
        testCard.addEventListener('click', () => {
            // Скрыть «домашний» экран лаб
            labHomeContent.style.display = 'none';
            // Показать контейнер Теста
            labContainerTest.style.display = 'flex';
            // Скрыть контейнер Задания (если было открыто)
            labContainerTasks.style.display = 'none';

            // Переходим в #section-lab
            showSection('section-lab');
            history.pushState({ section: 'section-lab' }, '', '/playground/lab/testbuilder');
            saveAppState();
        });
    }

    // Когда пользователь кликает по карточке «Задание»
    if (taskCard && labHomeContent && labContainerTasks && labContainerTest) {
        taskCard.addEventListener('click', () => {
            // Скрыть «домашний» экран лаб
            labHomeContent.style.display = 'none';
            // Показать контейнер Задания
            labContainerTasks.style.display = 'flex';
            // Скрыть контейнер Теста (если было открыто)
            labContainerTest.style.display = 'none';

            showSection('section-lab');
            history.pushState({ section: 'section-lab' }, '', '/playground/lab/taskbuilder');
            saveAppState();
        });
    }

    // (Аналогично можно обработать homeworkCard и manualCard, если нужно)
    if (homeworkCard) {
        homeworkCard.addEventListener('click', () => {
            alert('Пока не реализовано – Домашняя работа');
        });
    }
    if (manualCard) {
        manualCard.addEventListener('click', () => {
            alert('Пока не реализовано – Методичка');
        });
    }

    // ------------------------------------------------
    // 10) Редактируемый заголовок (Тест)
    // ------------------------------------------------
    if (documentTitleTest) {
        documentTitleTest.addEventListener('dblclick', function() {
            this.contentEditable = true;
            this.focus();
        });
        documentTitleTest.addEventListener('blur', function() {
            this.contentEditable = false;
        });
        documentTitleTest.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.contentEditable = false;
            }
        });
        documentTitleTest.addEventListener('input', function() {
            if (this.textContent.length > 50) {
                this.textContent = this.textContent.slice(0, 50);
            }
            document.title = `${this.textContent} - NeuroLab`;
        });
    }

    // ------------------------------------------------
    // 11) Редактируемый заголовок (Задание)
    // ------------------------------------------------
    if (documentTitleTasks) {
        documentTitleTasks.addEventListener('dblclick', function() {
            this.contentEditable = true;
            this.focus();
        });
        documentTitleTasks.addEventListener('blur', function() {
            this.contentEditable = false;
        });
        documentTitleTasks.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.contentEditable = false;
            }
        });
        documentTitleTasks.addEventListener('input', function() {
            if (this.textContent.length > 50) {
                this.textContent = this.textContent.slice(0, 50);
            }
            document.title = `${this.textContent} - NeuroLab (Задание)`;
        });
    }

    // ------------------------------------------------
    // 12) Инициализация «конструктора теста»
    // ------------------------------------------------
    initTestConstructor();

    function initTestConstructor() {
        const container = document.querySelector('.test-constructor');
        const addButton = document.querySelector('.add-test-row');
        if (!container || !addButton) return;

        let rowCount = 1;
        const maxRows = 7;
        const firstRow = container.querySelector('.test-row');

        if (firstRow) {
            populateTestRow(firstRow);
        }

        addButton.addEventListener('click', () => {
            if (rowCount >= maxRows) return;
            if (!firstRow) return;

            const newRow = firstRow.cloneNode(true);
            resetRow(newRow);
            populateTestRow(newRow);
            container.appendChild(newRow);
            rowCount++;

            if (rowCount >= maxRows) {
                addButton.style.display = 'none';
            }
        });

        container.addEventListener('change', (e) => {
            if (e.target && e.target.classList.contains('task-type-select')) {
                const row = e.target.closest('.task-row');
                if (!row) return;
                const answersSelect = row.querySelector('.task-answers-select');
                if (!answersSelect) return;

                answersSelect.innerHTML = '<option value="" disabled selected>Ответы</option>';
                answersSelect.disabled = false;

                if (e.target.value === 'closed') {
                    const closedOptions = [
                        { value: 'single', text: 'Одиночный ответ' },
                        { value: 'multiple', text: 'Множественный ответ' }
                    ];
                    closedOptions.forEach(opt => {
                        const optionEl = document.createElement('option');
                        optionEl.value = opt.value;
                        optionEl.textContent = opt.text;
                        answersSelect.appendChild(optionEl);
                    });
                } else if (e.target.value === 'open') {
                    const openOptions = [
                        { value: 'simple', text: 'Простой' },
                        { value: 'complex', text: 'Сложный' },
                    ];
                    openOptions.forEach(opt => {
                        const optionEl = document.createElement('option');
                        opt.value = opt.value;
                        opt.textContent = opt.text;
                        answersSelect.appendChild(opt);
                    });
                } else {
                    answersSelect.disabled = true;
                }
            }
        });
    }

    function populateTestRow(row) {
        const questionsSelect = row.querySelector('.questions-select');
        const pointsSelect = row.querySelector('.points-select');
        const answersSelect = row.querySelector('.answers-select');

        if (questionsSelect && questionsSelect.options.length <= 1) {
            questionsSelect.innerHTML = '<option value="" disabled selected>Вопросы</option>';
            for (let i = 1; i <= 30; i++) {
                const opt = document.createElement('option');
                opt.value = i;
                opt.textContent = i;
                questionsSelect.appendChild(opt);
            }
        }
        if (pointsSelect && pointsSelect.options.length <= 1) {
            pointsSelect.innerHTML = '<option value="" disabled selected>Баллы</option>';
            for (let i = 1; i <= 10; i++) {
                const opt = document.createElement('option');
                opt.value = i;
                opt.textContent = i;
                pointsSelect.appendChild(opt);
            }
        }
        if (answersSelect) {
            answersSelect.innerHTML = '<option value="" disabled selected>Ответы</option>';
            answersSelect.disabled = true;
        }
    }

    function resetRow(row) {
        const selects = row.querySelectorAll('select');
        selects.forEach(sel => sel.value = '');
    }

    // ------------------------------------------------
    // 13) Инициализация «конструктора задания»
    // ------------------------------------------------
    initTaskConstructor();

    function initTaskConstructor() {
        const container = document.querySelector('.task-constructor');
        const addButton = document.querySelector('.add-task-row');
        if (!container || !addButton) return;

        let rowCount = 1;
        const maxRows = 7;
        const firstRow = container.querySelector('.task-row');

        if (firstRow) {
            populateTaskRow(firstRow);
        }

        addButton.addEventListener('click', () => {
            if (rowCount >= maxRows) return;
            if (!firstRow) return;

            const newRow = firstRow.cloneNode(true);
            resetRow(newRow);
            populateTaskRow(newRow);
            container.appendChild(newRow);
            rowCount++;

            if (rowCount >= maxRows) {
                addButton.style.display = 'none';
            }
        });

        container.addEventListener('change', (e) => {
            if (e.target && e.target.classList.contains('task-type-select')) {
                const row = e.target.closest('.task-row');
                if (!row) return;
                const answersSelect = row.querySelector('.task-answers-select');
                if (!answersSelect) return;

                answersSelect.innerHTML = '<option value="" disabled selected>Ответы</option>';
                answersSelect.disabled = false;

                if (e.target.value === 'closed') {
                    const closedOptions = [
                        { value: 'single', text: 'Одиночный ответ' },
                        { value: 'multiple', text: 'Множественный ответ' }
                    ];
                    closedOptions.forEach(opt => {
                        const optionEl = document.createElement('option');
                        optionEl.value = opt.value;
                        optionEl.textContent = opt.text;
                        answersSelect.appendChild(optionEl);
                    });
                } else if (e.target.value === 'open') {
                    const openOptions = [
                        { value: 'simple', text: 'Простой' },
                        { value: 'complex', text: 'Сложный' },
                    ];
                    openOptions.forEach(opt => {
                        const optionEl = document.createElement('option');
                        opt.value = opt.value;
                        opt.textContent = opt.text;
                        answersSelect.appendChild(opt);
                    });
                } else {
                    answersSelect.disabled = true;
                }
            }
        });
    }

    function populateTaskRow(row) {
        // 1. Количество вопросов – от 1 до 30
        const questionsSelect = row.querySelector('.task-questions-select');
        if (questionsSelect && questionsSelect.options.length <= 1) {
            questionsSelect.innerHTML = '<option value="" disabled selected>Количество вопросов</option>';
            for (let i = 1; i <= 30; i++) {
                const opt = document.createElement('option');
                opt.value = i;
                opt.textContent = i;
                questionsSelect.appendChild(opt);
            }
        }

        // 2. Тип задания – универсальный список
        const typeSelect = row.querySelector('.task-type-select');
        if (typeSelect && typeSelect.options.length <= 1) {
            typeSelect.innerHTML = '<option value="" disabled selected>Тип задания</option>';
            const types = [
                "Извлечение информации",
                "Интерпретация",
                "Анализ",
                "Критическое мышление",
                "Структурирование текста"
            ];
            types.forEach(type => {
                const opt = document.createElement('option');
                opt.value = type;
                opt.textContent = type;
                typeSelect.appendChild(opt);
            });
        }

        // 3. Форма ответа – варианты ответа
        const answersSelect = row.querySelector('.task-answers-select');
        if (answersSelect && answersSelect.options.length <= 1) {
            answersSelect.innerHTML = '<option value="" disabled selected>Форма ответа</option>';
            const answerForms = [
                "Выбор ответа",
                "Краткий ответ",
                "Развернутый ответ"
            ];
            answerForms.forEach(form => {
                const opt = document.createElement('option');
                opt.value = form;
                opt.textContent = form;
                answersSelect.appendChild(opt);
            });
        }

        // 4. Уровень сложности – от 1 до 6
        const difficultySelect = row.querySelector('.task-difficulty-select');
        if (difficultySelect && difficultySelect.options.length <= 1) {
            difficultySelect.innerHTML = '<option value="" disabled selected>Уровень сложности</option>';
            for (let i = 1; i <= 6; i++) {
                const opt = document.createElement('option');
                opt.value = i;
                opt.textContent = i;
                difficultySelect.appendChild(opt);
            }
        }

        // 5. Оценка – от 1 до 10
        const pointsSelect = row.querySelector('.task-points-select');
        if (pointsSelect && pointsSelect.options.length <= 1) {
            pointsSelect.innerHTML = '<option value="" disabled selected>Оценка</option>';
            for (let i = 1; i <= 10; i++) {
                const opt = document.createElement('option');
                opt.value = i;
                opt.textContent = i;
                pointsSelect.appendChild(opt);
            }
        }
    }

    // ------------------------------------------------
    // 14) Слайдер сложности (Тест)
    // ------------------------------------------------
    const difficultySliderTest = document.querySelector('.difficulty-slider');
    const difficultyPointsTest = document.querySelectorAll('.difficulty-point');
    const difficultyLabelTest = document.querySelector('.difficulty-label');
    const difficultyNames = ['Очень лёгкий', 'Лёгкий', 'Нормальный', 'Сложный', 'Очень сложный'];

    if (difficultySliderTest && difficultyPointsTest && difficultyLabelTest) {
        difficultySliderTest.value = 2;
        updateTestDifficultyUI(2);

        difficultySliderTest.addEventListener('input', (e) => {
            updateTestDifficultyUI(parseInt(e.target.value));
        });
    }

    function updateTestDifficultyUI(value) {
        difficultyPointsTest.forEach((p, idx) => {
            p.classList.remove('active');
            if (idx <= value) p.classList.add('active');
        });
        if (difficultyLabelTest) difficultyLabelTest.textContent = difficultyNames[value];
    }

    // ------------------------------------------------
    // 15) Слайдер сложности (Задание)
    // ------------------------------------------------
    const difficultySliderTask = document.querySelector('.difficulty-slider-tasks');
    const difficultyPointsTask = document.querySelectorAll('.difficulty-point-tasks');
    const difficultyLabelTask = document.querySelector('.difficulty-label-tasks');

    if (difficultySliderTask && difficultyPointsTask && difficultyLabelTask) {
        difficultySliderTask.value = 2;
        updateTaskDifficultyUI(2);

        difficultySliderTask.addEventListener('input', (e) => {
            updateTaskDifficultyUI(parseInt(e.target.value));
        });
    }

    function updateTaskDifficultyUI(value) {
        difficultyPointsTask.forEach((p, idx) => {
            p.classList.remove('active');
            if (idx <= value) p.classList.add('active');
        });
        if (difficultyLabelTask) difficultyLabelTask.textContent = difficultyNames[value];
    }

    // ------------------------------------------------
    // 16) Кнопка «Сгенерировать» (ТЕСТ)
    // ------------------------------------------------
    if (generateBtnTest) {
        generateBtnTest.addEventListener('click', async () => {
            try {
                generateBtnTest.disabled = true;
                generateBtnTest.innerHTML = '<span class="spinner"></span> Генерация...';

                // Собираем данные
                const eduLang = document.querySelector('input[name="edu_lang_test"]:checked')?.value;
                const classLevel = document.querySelector('input[name="class_level_test"]:checked')?.value;
                const subjectCode = document.getElementById('subject-select-test')?.value;
                const author = document.getElementById('author-select-test')?.value;
                const theme = document.querySelector('input[name="theme_test"]')?.value;
                const difficulty = parseInt(difficultySliderTest?.value || '2', 10);
                const customSettings = document.querySelector('textarea[name="custom_settings_test"]')?.value || '';

                // Собираем «конструктор теста»
                const testRows = Array.from(document.querySelectorAll('.test-constructor .test-row')).map(row => ({
                    questions: row.querySelector('.questions-select')?.value,
                    questionType: row.querySelector('.type-select')?.value,
                    answersType: row.querySelector('.answers-select')?.value,
                    points: row.querySelector('.points-select')?.value,
                }));

                // Пример ожидания ответа
                await new Promise(r => setTimeout(r, 1200));

                // Мокаем ответ
                const mockResponse = {
                    material: `Сгенерированный ТЕКСТ (TEST)\nПараметры:\n- Язык: ${eduLang}\n- Класс: ${classLevel}\n- Предмет: ${subjectCode}\n- Автор: ${author}\n- Тема: ${theme}\n- Сложность: ${difficulty}\n- Настройки: ${customSettings}\n- Строки конструктора: ${JSON.stringify(testRows, null, 2)}`,
                    answers: {
                        BlockA: ["Ответ 1", "Ответ 2", "Ответ 3"],
                        BlockB: [["Подответ 1.1", "Подответ 1.2"], ["Подответ 2.1", "Подответ 2.2"]]
                    },
                    comments: "Комментарии ИИ для Теста"
                };

                if (workspaceMaterialTest) workspaceMaterialTest.value = mockResponse.material;
                if (mockResponse.answers) {
                    updateAnswersDisplay(mockResponse.answers, 'answersDisplay');
                }
                if (mockResponse.comments) aiCommentsAreaTest.value = mockResponse.comments;

            } catch (error) {
                showError(error.message);
            } finally {
                generateBtnTest.disabled = false;
                generateBtnTest.textContent = 'Сгенерировать';
            }
        });
    }

    // ------------------------------------------------
    // 17) Кнопка «Сгенерировать» (ЗАДАНИЕ)
    // ------------------------------------------------
    if (generateBtnTask) {
        generateBtnTask.addEventListener('click', async () => {
            try {
                generateBtnTask.disabled = true;
                generateBtnTask.innerHTML = '<span class="spinner"></span> Генерация...';

                const eduLang = document.querySelector('input[name="edu_lang_task"]:checked')?.value;
                const classLevel = document.querySelector('input[name="class_level_task"]:checked')?.value;
                const subjectCode = document.getElementById('subject-select-task')?.value;
                const author = document.getElementById('author-select-task')?.value;
                const theme = document.querySelector('input[name="theme_task"]')?.value;
                const difficulty = parseInt(difficultySliderTask?.value || '2', 10);
                const customSettings = document.querySelector('textarea[name="custom_settings_task"]')?.value || '';

                const taskRows = Array.from(document.querySelectorAll('.task-constructor .task-row')).map(row => ({
                    questions: row.querySelector('.task-questions-select')?.value,
                    questionType: row.querySelector('.task-type-select')?.value,
                    answersType: row.querySelector('.task-answers-select')?.value,
                    points: row.querySelector('.task-points-select')?.value,
                }));

                await new Promise(r => setTimeout(r, 1200));

                const mockResponse = {
                    material: `Сгенерированный ТЕКСТ (TASK)\nПараметры:\n- Язык: ${eduLang}\n- Класс: ${classLevel}\n- Предмет: ${subjectCode}\n- Автор: ${author}\n- Тема: ${theme}\n- Сложность: ${difficulty}\n- Настройки: ${customSettings}\n- Строки конструктора: ${JSON.stringify(taskRows, null, 2)}`,
                    answers: {
                        ZadanieBlock: ["Задание. Ответ 1", "Задание. Ответ 2"],
                        AnotherBlock: [
                            ["Подответ З1.1", "Подответ З1.2"],
                            ["Подответ З2.1", "Подответ З2.2"]
                        ]
                    },
                    comments: "Комментарии ИИ для Задания"
                };

                if (workspaceMaterialTask) workspaceMaterialTask.value = mockResponse.material;
                if (mockResponse.answers) {
                    updateAnswersDisplay(mockResponse.answers, 'answersDisplayTasks');
                }
                if (mockResponse.comments) aiCommentsAreaTask.value = mockResponse.comments;

            } catch (error) {
                showError(error.message);
            } finally {
                generateBtnTask.disabled = false;
                generateBtnTask.textContent = 'Сгенерировать';
            }
        });
    }

    // ------------------------------------------------
    // 18) Чат в «Тесте»
    // ------------------------------------------------
    if (chatInputTest && sendButtonTest && workspaceMaterialTest) {
        autoResizeTextarea(chatInputTest);
        sendButtonTest.addEventListener('click', () => {
            sendMessageTest();
        });
    }

    function sendMessageTest() {
        const chatMessage = chatInputTest.value.trim();
        if (!chatMessage) return;

        chatInputTest.value = '';
        chatInputTest.style.height = '24px';
        chatInputTest.parentElement.style.minHeight = '50px';
        
        // Пример ответа
        workspaceMaterialTest.value += `\n[Ответ ИИ (TEST) на сообщение: "${chatMessage}"]\n`;
    }

    // ------------------------------------------------
    // 19) Чат в «Задании»
    // ------------------------------------------------
    if (chatInputTask && sendButtonTask && workspaceMaterialTask) {
        autoResizeTextarea(chatInputTask);
        sendButtonTask.addEventListener('click', () => {
            sendMessageTask();
        });
    }

    function sendMessageTask() {
        const chatMessage = chatInputTask.value.trim();
        if (!chatMessage) return;

        chatInputTask.value = '';
        chatInputTask.style.height = '24px';
        chatInputTask.parentElement.style.minHeight = '50px';

        workspaceMaterialTask.value += `\n[Ответ ИИ (TASK) на сообщение: "${chatMessage}"]\n`;
    }

    // ------------------------------------------------
    // 20) Универсальная функция авто-ресайза textarea
    // ------------------------------------------------
    function autoResizeTextarea(textarea) {
        const minHeight = 50;
        const maxHeight = 300;

        textarea.style.height = (minHeight - 26) + 'px';
        textarea.parentElement.style.minHeight = minHeight + 'px';

        textarea.addEventListener('input', function() {
            this.style.height = '24px';
            const scrollHeight = this.scrollHeight;
            if (scrollHeight > 24) {
                const newHeight = Math.min(scrollHeight, maxHeight);
                this.style.height = newHeight + 'px';
                this.parentElement.style.minHeight = (newHeight + 26) + 'px';
            } else {
                this.style.height = '24px';
                this.parentElement.style.minHeight = minHeight + 'px';
            }
            this.style.overflowY = (scrollHeight > maxHeight ? 'auto' : 'hidden');
        });
    }

    // Обработчики для popup конструктора
    const editBtn = document.querySelector('.edit-constructor-btn');
    const popup = document.querySelector('.constructor-popup');
    const closeBtn = document.querySelector('.close-popup-btn');
    
    // Открытие popup
    editBtn.addEventListener('click', () => {
        popup.classList.add('active');
        document.body.style.overflow = 'hidden';
    });
    
    // Закрытие popup
    closeBtn.addEventListener('click', () => {
        popup.classList.remove('active');
        document.body.style.overflow = '';
    });
    
    // Закрытие по клику вне окна
    popup.addEventListener('click', (e) => {
        if (e.target === popup) {
            popup.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
    
    // Добавление новой строки
    const addRowBtn = popup.querySelector('.add-task-row');
    const constructor = popup.querySelector('.task-constructor');
    
    // Создаем кнопку удаления
    function createDeleteButton() {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-task-row';
        deleteBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14">
                <path d="M13 7H1" stroke="#FF3B30" stroke-width="2" stroke-linecap="round"/>
            </svg>
        `;
        deleteBtn.addEventListener('click', function() {
            const rows = constructor.querySelectorAll('.task-row');
            if (rows.length > 1) {
                this.closest('.task-row').remove();
                updateDeleteButtons();
            }
        });
        return deleteBtn;
    }

    // Обновление состояния кнопок удаления
    function updateDeleteButtons() {
        const rows = constructor.querySelectorAll('.task-row');
        const deleteBtns = constructor.querySelectorAll('.delete-task-row');
        
        deleteBtns.forEach(btn => {
            btn.style.visibility = rows.length > 1 ? 'visible' : 'hidden';
        });
    }

    // Добавляем кнопку удаления к существующей строке
    const firstRow = constructor.querySelector('.task-row');
    if (firstRow && !firstRow.querySelector('.delete-task-row')) {
        firstRow.appendChild(createDeleteButton());
        updateDeleteButtons();
    }
    
    addRowBtn.addEventListener('click', () => {
        const newRow = constructor.querySelector('.task-row').cloneNode(true);
        // Очищаем значения в новой строке
        newRow.querySelectorAll('select').forEach(select => {
            select.selectedIndex = 0;
        });
        
        // Удаляем старую кнопку удаления и добавляем новую
        const oldDeleteBtn = newRow.querySelector('.delete-task-row');
        if (oldDeleteBtn) {
            oldDeleteBtn.remove();
        }
        newRow.appendChild(createDeleteButton());
        
        constructor.appendChild(newRow);
        updateDeleteButtons();
    });

    // В существующем обработчике DOMContentLoaded
const confirmBtn = popup.querySelector('.constructor-confirm-btn');

confirmBtn.addEventListener('click', () => {
    // Здесь можно добавить логику сохранения данных конструктора
    popup.classList.remove('active');
    document.body.style.overflow = '';
    
    // Показываем уведомление об успешном сохранении
    const notification = document.createElement('div');
    notification.className = 'save-notification';
    notification.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
            <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" fill="#4CAF50"/>
        </svg>
        <span>Конструктор сохранен</span>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
});

// Стили для уведомления
const style = document.createElement('style');
style.textContent = `
    .save-notification {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: var(--color-bg-lower);
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        display: flex;
        align-items: center;
        gap: 8px;
        animation: slideIn 0.3s ease, fadeOut 0.3s ease 2.7s;
        z-index: 1100;
    }
    
    .save-notification span {
        color: var(--color-dark-text);
        font-family: 'Gilroy', sans-serif;
        font-size: 14px;
    }
    
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
    
    body.dark-theme .save-notification {
        background: var(--color-bg-upper);
    }
    
    body.dark-theme .save-notification span {
        color: var(--color-light-text);
    }
`;
document.head.appendChild(style);

}); // end DOMContentLoaded
