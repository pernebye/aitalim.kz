// js/subjects.js
// ========================

// Глобальные переменные для хранения распарсенных данных CSV
let dataKAZ = null;
let dataRUS = null;

// Значения, при которых предмет должен игнорироваться
const skipValues = ['', '/', '—', 'X'];

/**
 * Преобразует значение класса (например, "10-emn") в название столбца (например, "10_EMN").
 */
function mapClassToColumn(classValue) {
  switch (classValue) {
    case '10-emn': return '10_EMN';
    case '10-ogn': return '10_OGN';
    case '11-emn': return '11_EMN';
    case '11-ogn': return '11_OGN';
    default:
      return classValue; // 4,5,6,7,8,9
  }
}

/**
 * Проверяет, нужно ли пропустить ячейку (если там пусто, '/', '—', 'X' и т.п.).
 */
function shouldSkipCell(cellValue) {
  if (!cellValue) return true;
  const trimmed = cellValue.trim();
  return skipValues.includes(trimmed);
}

/**
 * Возвращает массив доступных предметов (объекты { name, code }) 
 * на основе выбранного класса и данных CSV.
 */
function getAvailableSubjects(csvData, classValue) {
  const colName = mapClassToColumn(classValue);
  const subjects = [];

  csvData.forEach(row => {
    const cellValue = row[colName] || '';
    if (shouldSkipCell(cellValue)) {
      return;
    }
    // Если дошли сюда, значит предмет доступен
    subjects.push({
      name: row["Предмет"],
      code: row["Код"]
    });
  });

  return subjects;
}

/**
 * Парсим одну ячейку CSV, чтобы получить список «автор + год».
 */
function parseAuthorsFromCell(cellValue) {
  // Разделяем по запятой
  const textbookTokens = cellValue.split(",");
  const results = [];

  textbookTokens.forEach(token => {
    const trimmed = token.trim();
    if (!trimmed) return;

    // Проверяем на "+"
    const plusParts = trimmed.split("+");
    const authorsForThisToken = plusParts.map(part => {
      const splitted = part.split("_");
      // обычная структура: [0]WHC / [1]11 / [2]OGN / [3]RUS / [4]2020 / [5]"Фамилия И.О." / [6]число
      const year = splitted[4] || "";
      const authorRaw = splitted[5] || "Неизвестный автор";
      const author = authorRaw.trim();
      return year ? (author + " " + year) : author;
    });

    const finalAuthorLabel = authorsForThisToken.join(" + ");
    results.push(finalAuthorLabel);
  });

  return results;
}

/* =====================
   ФУНКЦИИ ДЛЯ ТЕСТА
   ===================== */
function updateSubjectsTest() {
  const langRadio = document.querySelector('.lang-switch input[name="edu_lang_test"]:checked');
  const classRadio = document.querySelector('.class-switch input[name="class_level_test"]:checked');
  const subjectSelect = document.getElementById('subject-select-test');

  if (!subjectSelect) return;
  subjectSelect.innerHTML = '';
  
  // Если не выбраны язык или класс, выходим
  if (!langRadio || !classRadio) return;

  const lang = langRadio.value;      
  const classVal = classRadio.value; 

  let csvData = (lang === 'kaz') ? dataKAZ : dataRUS;
  if (!csvData) {
    // CSV ещё не загружен
    return;
  }

  // Фильтруем предметы
  const subjects = getAvailableSubjects(csvData, classVal);

  // Добавляем "Выберите предмет"
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Выберите предмет';
  defaultOption.selected = true;
  defaultOption.disabled = true;
  subjectSelect.appendChild(defaultOption);

  // Добавляем предметы
  subjects.forEach(subj => {
    const option = document.createElement('option');
    option.value = subj.code;
    option.textContent = subj.name;
    subjectSelect.appendChild(option);
  });

  // Очистим список авторов
  clearAuthorsTest();
}

function clearAuthorsTest() {
  const authorSelect = document.getElementById('author-select-test');
  if (!authorSelect) return;
  authorSelect.innerHTML = '';
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Выберите автора';
  defaultOption.selected = true;
  defaultOption.disabled = true;
  authorSelect.appendChild(defaultOption);
}

function updateAuthorsTest() {
  const langRadio = document.querySelector('.lang-switch input[name="edu_lang_test"]:checked');
  const classRadio = document.querySelector('.class-switch input[name="class_level_test"]:checked');
  const subjectSelect = document.getElementById('subject-select-test');
  const authorSelect = document.getElementById('author-select-test');

  if (!authorSelect) return;
  clearAuthorsTest();

  if (!langRadio || !classRadio || !subjectSelect) return;

  const lang = langRadio.value;
  const classVal = classRadio.value;
  const subjectCode = subjectSelect.value;
  if (!subjectCode) return;

  let csvData = (lang === 'kaz') ? dataKAZ : dataRUS;
  if (!csvData) return;

  // Ищем строку, у которой Код == subjectCode
  const row = csvData.find(r => r["Код"] === subjectCode);
  if (!row) return;

  const colName = mapClassToColumn(classVal);
  const cellValue = row[colName] || '';

  if (shouldSkipCell(cellValue)) return;

  const authors = parseAuthorsFromCell(cellValue);

  authors.forEach(a => {
    const option = document.createElement('option');
    option.value = a;
    option.textContent = a;
    authorSelect.appendChild(option);
  });
}

/* =====================
   ФУНКЦИИ ДЛЯ ЗАДАНИЯ
   ===================== */
function updateSubjectsTask() {
  const langRadio = document.querySelector('.lang-switch-tasks input[name="edu_lang_task"]:checked');
  const classRadio = document.querySelector('.class-switch-tasks input[name="class_level_task"]:checked');
  const subjectSelect = document.getElementById('subject-select-task');

  if (!subjectSelect) return;
  subjectSelect.innerHTML = '';

  if (!langRadio || !classRadio) return;

  const lang = langRadio.value;
  const classVal = classRadio.value;

  let csvData = (lang === 'kaz') ? dataKAZ : dataRUS;
  if (!csvData) {
    return;
  }

  const subjects = getAvailableSubjects(csvData, classVal);

  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Выберите предмет';
  defaultOption.selected = true;
  defaultOption.disabled = true;
  subjectSelect.appendChild(defaultOption);

  subjects.forEach(subj => {
    const option = document.createElement('option');
    option.value = subj.code;
    option.textContent = subj.name;
    subjectSelect.appendChild(option);
  });

  clearAuthorsTask();
}

function clearAuthorsTask() {
  const authorSelect = document.getElementById('author-select-task');
  if (!authorSelect) return;
  authorSelect.innerHTML = '';
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Выберите автора';
  defaultOption.selected = true;
  defaultOption.disabled = true;
  authorSelect.appendChild(defaultOption);
}

function updateAuthorsTask() {
  const langRadio = document.querySelector('.lang-switch-tasks input[name="edu_lang_task"]:checked');
  const classRadio = document.querySelector('.class-switch-tasks input[name="class_level_task"]:checked');
  const subjectSelect = document.getElementById('subject-select-task');
  const authorSelect = document.getElementById('author-select-task');

  if (!authorSelect) return;
  clearAuthorsTask();

  if (!langRadio || !classRadio || !subjectSelect) return;

  const lang = langRadio.value;
  const classVal = classRadio.value;
  const subjectCode = subjectSelect.value;
  if (!subjectCode) return;

  let csvData = (lang === 'kaz') ? dataKAZ : dataRUS;
  if (!csvData) return;

  const row = csvData.find(r => r["Код"] === subjectCode);
  if (!row) return;

  const colName = mapClassToColumn(classVal);
  const cellValue = row[colName] || '';

  if (shouldSkipCell(cellValue)) return;

  const authors = parseAuthorsFromCell(cellValue);

  authors.forEach(a => {
    const option = document.createElement('option');
    option.value = a;
    option.textContent = a;
    authorSelect.appendChild(option);
  });
}

// =====================
// ЗАГРУЗКА CSV-ФАЙЛОВ
// =====================
function loadCsvFiles() {
  Papa.parse('/data/checklist_kaz.csv', {
    download: true,
    header: true,
    complete: function(results) {
      dataKAZ = results.data;
      console.log("KAZ data loaded", dataKAZ);
    },
    error: function(err) {
      console.error("Ошибка загрузки kaz CSV:", err);
    }
  });

  Papa.parse('/data/checklist_rus.csv', {
    download: true,
    header: true,
    complete: function(results) {
      dataRUS = results.data;
      console.log("RUS data loaded", dataRUS);
    },
    error: function(err) {
      console.error("Ошибка загрузки rus CSV:", err);
    }
  });
}

function setEventListeners() {
  // ----- Для Теста -----
  // При изменении языка или класса → обновляем список предметов
  document.querySelectorAll('.lang-switch input[name="edu_lang_test"]').forEach(radio => {
    radio.addEventListener('change', updateSubjectsTest);
  });
  document.querySelectorAll('.class-switch input[name="class_level_test"]').forEach(radio => {
    radio.addEventListener('change', updateSubjectsTest);
  });
  // При выборе предмета → обновляем список авторов
  const subjectSelectTest = document.getElementById('subject-select-test');
  if (subjectSelectTest) {
    subjectSelectTest.addEventListener('change', updateAuthorsTest);
  }

  // ----- Для Задания -----
  document.querySelectorAll('.lang-switch-tasks input[name="edu_lang_task"]').forEach(radio => {
    radio.addEventListener('change', updateSubjectsTask);
  });
  document.querySelectorAll('.class-switch-tasks input[name="class_level_task"]').forEach(radio => {
    radio.addEventListener('change', updateSubjectsTask);
  });
  const subjectSelectTask = document.getElementById('subject-select-task');
  if (subjectSelectTask) {
    subjectSelectTask.addEventListener('change', updateAuthorsTask);
  }
}

// При загрузке страницы:
document.addEventListener('DOMContentLoaded', () => {
  loadCsvFiles();
  setEventListeners();
});
