// neurolab-backend/src/app.js

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';
import Papa from 'papaparse';
import authRoutes from './routes/auth.js';
import dotenv from 'dotenv';
import https from 'https';

// Для работы с __dirname в ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Явно указываем путь к .env (если он находится на уровень выше, например, в neurolab-backend)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

/* Если ранее использовался CSV для сопоставления file_id – теперь не нужен,
   так как мы будем работать только с именами файлов. Но код оставляю для справки.
*/
// --- Загрузка файла сопоставления file_id --- 
const csvFilePath = path.join(__dirname, '../files_info.csv');
let fileIdMap = {};
try {
  const csvContent = fs.readFileSync(csvFilePath, 'utf8');
  const lines = csvContent.split('\n');
  // Пропускаем заголовок (первая строка)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(';');
    if (parts.length >= 3) {
      const localName = parts[1].trim();
      const file_id = parts[2].trim();
      fileIdMap[localName] = file_id;
    }
  }
  console.log("Loaded fileIdMap:", fileIdMap);
} catch (err) {
  console.error("Error loading files_info.csv:", err);
}

// Папка, где хранятся все книги (books). Мы находимся в "neurolab-backend/src",
// поэтому поднимаемся на 1 уровень вверх, потом в "books".
const baseBooksDir = path.join(__dirname, '../books');

const app = express();

// Middleware
app.use(express.json());
app.use(cors({
  origin: [
      process.env.API_URL,
      'https://aitalim.kz',
      'http://194.32.140.113',
      'http://localhost:3000',
      'http://localhost:5000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// CSP middleware
app.use((req, res, next) => {
    res.setHeader(
        'Content-Security-Policy',
        "default-src * 'unsafe-inline' 'unsafe-eval'; " +
        "script-src * 'unsafe-inline' 'unsafe-eval'; " +
        "style-src * 'unsafe-inline'; " +
        "img-src * data: blob: 'unsafe-inline'; " +
        "font-src * data: 'unsafe-inline'; " +
        "connect-src * 'unsafe-inline'; " +
        "frame-src *;"
    );
    console.log('Получен запрос:', req.method, req.url);
    next();
});

// Логирование запроса (для отладки)
app.use((req, res, next) => {
    console.log('Request:', {
        method: req.method,
        path: req.path,
        body: req.body,
        headers: req.headers
    });
    next();
});

// Обработка статических файлов должна быть первой
app.use(express.static(path.join(__dirname, '../../')));

// Словарь уровней сложности
const difficultyMap = {
  0: {
    name: "Очень лёгкий",
    explanation: "Тестовые задания с простыми, базовыми вопросами, не требующими глубокого анализа."
  },
  1: {
    name: "Лёгкий", 
    explanation: "Задания, в основном проверяющие базовые знания, но чуть более детализированные, чем очень лёгкий."
  },
  2: {
    name: "Нормальный",
    explanation: "Стандартная сложность: часть заданий на базу, часть — на применение знаний."
  },
  3: {
    name: "Сложный",
    explanation: "Углублённые вопросы, требующие логического мышления и анализа, могут быть дополнительные подводящие шаги."
  },
  4: {
    name: "Очень сложный",
    explanation: "Комплексные задачи с несколькими этапами решения и требующие глубоких знаний и аналитики."
  }
};

// Загрузка CSV данных
let dataKAZ = [];
let dataRUS = [];

function loadCsvFile(filePath) {
  return new Promise((resolve, reject) => {
    try {
      // Читаем файл и удаляем BOM
      let fileContent = fs.readFileSync(filePath, 'utf8')
        .replace(/^\uFEFF/, '');
      
      // Нормализуем переносы строк
      fileContent = fileContent
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n');
      
      // Проверяем и исправляем разделители
      const lines = fileContent.split('\n');
      const headerFields = lines[0].split(';').length;
      
      // Проверяем каждую строку
      const cleanedLines = lines.map((line, index) => {
        if (!line.trim()) return null; // Пропускаем пустые строки
        
        const fields = line.split(';');
        if (fields.length !== headerFields) {
          console.warn(`Строка ${index + 1}: неверное количество полей (${fields.length}, ожидалось ${headerFields})`);
          console.warn('Проблемная строка:', line);
          return null;
        }
        return line;
      }).filter(Boolean); // Удаляем null
      
      // Собираем обратно в строку
      fileContent = cleanedLines.join('\n');
      
      Papa.parse(fileContent, {
        delimiter: ';',
        header: true,
        skipEmptyLines: true,
        encoding: 'UTF-8',
        complete: (results) => {
          if (results.errors.length > 0) {
            console.warn('Предупреждения при парсинге CSV:', results.errors);
          }
          
          // Проверяем валидность данных
          const validData = results.data.filter(row => {
            const hasRequiredFields = row['Код'] && Object.keys(row).length === headerFields;
            if (!hasRequiredFields) {
              console.warn('Пропущена невалидная строка:', row);
            }
            return hasRequiredFields;
          });
          
          resolve(validData);
        },
        error: (err) => reject(err)
      });
    } catch (error) {
      reject(error);
    }
  });
}

(async () => {
  try {
    dataKAZ = await loadCsvFile(path.join(__dirname, '../../data', 'checklist_kaz.csv'));
    dataRUS = await loadCsvFile(path.join(__dirname, '../../data', 'checklist_rus.csv'));
    console.log("CSV KAZ + RUS loaded on server side.");
  } catch (err) {
    console.error('Ошибка загрузки CSV:', err);
  }
})();

// Вспомогательные функции для работы с CSV
function mapClassToColumn(classValue) {
  switch (classValue) {
    case '10-emn': return '10_EMN';
    case '10-ogn': return '10_OGN';
    case '11-emn': return '11_EMN';
    case '11-ogn': return '11_OGN';
    default:
      return classValue;
  }
}

function shouldSkipCell(cellValue) {
  if (!cellValue) return true;
  const trimmed = cellValue.trim();
  const skipValues = ['', '/', '—', 'X'];
  return skipValues.includes(trimmed);
}

function splitByCommaButKeepPlus(cellValue) {
  return cellValue.split(',').map(item => item.trim()).filter(Boolean);
}

function splitByPlus(fragment) {
  return fragment.split('+').map(item => item.trim()).filter(Boolean);
}

function getPdfFolder(classLevel) {
  const splitted = classLevel.split('-');
  const classOnly = splitted[0];
  
  // Папка с PDF: baseBooksDir + "9_class_ocr" (или "8_class_ocr" и т.д.)
  return path.join(baseBooksDir, `${classOnly}_class_ocr`);
}

function buildPdfFileList(fragment, pdfFolder) {
  const splitted = fragment.split('_');
  let partStr = splitted[6] || '0';
  
  const partCount = parseInt(partStr, 10);
  if (isNaN(partCount)) {
    return [path.join(pdfFolder, fragment + '.pdf')];
  }

  if (partCount === 0) {
    const baseName = fragment.replace(/_0$/, '');
    return [path.join(pdfFolder, baseName + '.pdf')];
  } else {
    const result = [];
    const baseName = fragment.replace(/_\d+$/, '');
    for (let i = 1; i <= partCount; i++) {
      result.push(path.join(pdfFolder, `${baseName}_${i}.pdf`));
    }
    return result;
  }
}

/**
 * Функция поиска учебников.
 * Теперь она возвращает массив имён файлов (без расширения), которые будут
 * включены в текст запроса. Таким образом, ассистент получит строку с названиями книг.
 */
function getAllTextbookFiles(lang, classLevel, subjectCode, author) {
  console.log('=== getAllTextbookFiles ===');
  console.log('Входные параметры:', { lang, classLevel, subjectCode, author });
  
  const csvData = (lang === 'kaz') ? dataKAZ : dataRUS;
  console.log('Загруженные CSV данные:', csvData?.length, 'строк');
  
  if (!csvData || !Array.isArray(csvData)) {
    console.error('CSV данные отсутствуют или имеют неверный формат');
    return [];
  }

  // Отладка структуры данных
  console.log('Пример первой строки:', csvData[0]);
  console.log('Доступные коды:', csvData.map(r => r['Код']).filter(Boolean));

  const row = csvData.find(r => r['Код'] === subjectCode);
  if (!row) {
    console.error('Строка не найдена. Искомый код:', subjectCode);
    return [];
  }

  const colName = mapClassToColumn(classLevel);
  console.log('Ищем в колонке:', colName);
  console.log('Найденная строка:', row);
  
  const cellValue = row[colName];
  console.log('Значение ячейки:', cellValue);

  if (shouldSkipCell(cellValue)) {
    console.log('Ячейка пропущена по правилам skipCell');
    return [];
  }

  const pdfFolder = getPdfFolder(classLevel);
  console.log('Папка PDF:', pdfFolder);
  
  const commaFragments = splitByCommaButKeepPlus(cellValue);
  console.log('Фрагменты после разделения запятыми:', commaFragments);

  let finalFiles = [];

  commaFragments.forEach(fragment => {
    const plusParts = splitByPlus(fragment);
    console.log('Части после разделения по плюсу:', plusParts);
    
    plusParts.forEach(onePart => {
      if (author) {
        const authorWithoutYear = author.slice(0, -5);
        const onePartLower = onePart.toLowerCase();
        const authorLower = authorWithoutYear.toLowerCase();

        if (!onePartLower.includes(authorLower)) {
          return;
        }
      }

      const pdfList = buildPdfFileList(onePart, pdfFolder);
      console.log('Сгенерированные пути к PDF для части:', onePart, ':', pdfList);
      finalFiles = finalFiles.concat(pdfList);
    });
  });

  // Вместо формирования объектов attachments с file_id,
  // возвращаем просто имена файлов (без расширения).
  const fileNames = finalFiles.map(filePath => path.basename(filePath, '.pdf'));
  console.log('Найденные учебники (имена файлов):', fileNames);
  return fileNames;
}

/**
 * Функция формирования промпта для генерации теста.
 * В списке учебников теперь подставляются просто имена файлов.
 */
function buildPrompt(params, textbookFileNames) {
    const difficultyInfo = difficultyMap[params.difficultyLevel] || difficultyMap[2];
    const difficultyName = difficultyInfo.name;
    const difficultyExplanation = difficultyInfo.explanation;
  
    let pdfListText = '';
    if (textbookFileNames.length > 0) {
      pdfListText = textbookFileNames.map(file => `- ${file}`).join('\n');
    } else {
      pdfListText = 'Нет найденных учебников по данному параметру. Используй общие знания (но все равно отвечай строго по формату).';
    }
  
    const testRowsText = params.testConstructor
      .map((row, idx) => {
        return `Блок #${idx+1}: 
    - Количество вопросов: ${row.questions}
    - Тип вопроса: ${row.questionType} (ответы: ${row.answersType})
    - Баллы: ${row.points}
  `;
      })
      .join('\n');
  
    // Формируем промпт – всё внутри JSON-структуры (без внешних комментариев)
    return `
  Ты — умный ИИ, специализирующийся на генерации тестовых заданий.
  
  **ВАЖНО**: 
  - Твоё сообщение-ответ **должно быть строго в формате JSON** — никаких комментариев или пояснений вне JSON. 
  - Все комментарии, которые ты хочешь дать (или уточнения), должны находиться внутри поля "comments".
  - Ты не имеешь права добавлять текст вне фигурных скобок JSON. Никакого префикса, постфикса, пожалуйста.
  
  Твоя задача:
  1) Создать тест (поле "material") и правильные ответы (поле "answers") в соответствии с нижеприведённой структурой.
  2) Все твои комментарии/объяснения помести в ключ "comments" внутри JSON.
  3) Итоговая структура ответа в точности такая:
  \`\`\`
  {
    "material": "...",
    "answers": "...(или объект)",
    "comments": "..."
  }
  \`\`\`
  
  ### Исходные данные
  
  1) Язык отделения (обучения): ${params.eduLang.toUpperCase()}
  2) Класс: ${params.classLevel}
  3) Предмет: ${params.subjectName}
  4) Автор: ${params.author || 'Любой автор из списка, если есть несколько.'}
  5) Тема: ${params.theme}
  6) Уровень сложности: ${difficultyName}
     - Подробности: ${difficultyExplanation}
  7) Пользовательские настройки: ${params.customSettings}
  
  Учебники (PDF) для использования:
  ${pdfListText}
  
  Структура теста:
  ${testRowsText}
  
  ### Формат ответа
  
  **Внимание**: Ответ ДОЛЖЕН быть ТОЛЬКО valid JSON. Пример желаемой структуры:
  \`\`\`
  {
    "material": "Здесь сам тест (включая все блоки)...",
    "answers": {
      "Блок #1": ["ответ1", "ответ2"],
      "Блок #2": ["ответ1", "ответ2"]
    },
    "comments": "Любые комментарии ИИ пишешь тут"
  }
  \`\`\`
  
  **Запрещено** писать что-либо вне JSON-структуры. Если у тебя нет комментариев — сделай пустую строку в поле "comments".
  
  Пожалуйста, сгенерируй тест строго по заданной структуре, используя информацию из приложенных учебников, если они доступны.
  Если учебники не найдены, опирайся на общие знания, но всё равно соблюдай формат.
  `;
}
  
/**
 * Функция отправки запроса к OpenAI.
 * Осталась без изменений.
 */
async function callOpenAI(prompt) {
  console.log('=== callOpenAI ===');
  console.log('Отправка запроса к OpenAI');
  console.log('Используемая модель:', "gpt-4o");
  
  const data = {
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: prompt }
    ],
    temperature: 0.7
  };

  try {
    console.log('Отправка запроса на:', 'https://api.openai.com/v1/chat/completions');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify(data)
    });

    console.log('Статус ответа:', response.status);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API Error:', errorData);
      throw new Error(errorData.error?.message || 'OpenAI API Error');
    }

    const result = await response.json();
    console.log('Получен ответ от OpenAI');
    return result.choices[0].message.content;
  } catch (error) {
    console.error('Ошибка при запросе к OpenAI:', error);
    throw error;
  }
}

// Функция для опроса статуса run (ожидание результата от потока)
async function pollRunResult(thread_id, run_id, timeout = 300000, interval = 2000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const runStatusResponse = await fetch(`https://api.openai.com/v1/threads/${thread_id}/runs/${run_id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'OpenAI-Beta': 'assistants=v2'
      }
    });

    if (!runStatusResponse.ok) {
      const errData = await runStatusResponse.json();
      throw new Error(errData.error?.message || 'Ошибка при получении статуса run');
    }

    const runStatusData = await runStatusResponse.json();
    console.log(`Текущий статус run: ${runStatusData.status}`);

    // Проверяем, завершен ли run
    if (runStatusData.status === 'completed' || runStatusData.status === 'succeeded') {
      // Ожидаем финальный ответ от ассистента
      const messagesResponse = await fetch(`https://api.openai.com/v1/threads/${thread_id}/messages`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'OpenAI-Beta': 'assistants=v2'
        }
      });

      if (!messagesResponse.ok) {
        const errData = await messagesResponse.json();
        throw new Error(errData.error?.message || 'Ошибка при получении сообщений из потока');
      }

      const messagesData = await messagesResponse.json();
      console.log("Сообщения в потоке:", messagesData);

      // Находим последнее сообщение от ассистента
      const assistantMessage = messagesData.data.find(msg => msg.role === 'assistant');
      if (assistantMessage && assistantMessage.content) {
        return assistantMessage.content;
      } else {
        throw new Error('Ответ ассистента не найден!');
      }
    }

    if (runStatusData.status === 'failed' || runStatusData.status === 'cancelled') {
      throw new Error(`Run завершился с ошибкой: ${runStatusData.status}`);
    }

    // Ждём и повторяем запрос
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error('Превышено время ожидания получения результата от run');
}

// Новая функция для корректного извлечения и парсинга ответа от OpenAI
function parseAIResponse(responseData) {
  let answerContent = "";

  if (typeof responseData !== "string") {
    if (Array.isArray(responseData)) {
      answerContent = responseData
        .map(block => {
          if (typeof block === "string") return block;
          if (block && block.text && typeof block.text.value === "string") {
            return block.text.value;
          }
          return "";
        })
        .join("\n");
    }
    else if (responseData && typeof responseData === "object") {
      if (responseData.text && typeof responseData.text.value === "string") {
        answerContent = responseData.text.value;
      } else {
        answerContent = JSON.stringify(responseData);
      }
    }
  } else {
    answerContent = responseData;
  }

  answerContent = answerContent.trim();

  const codeBlockRegex = /^```(?:json)?\s*([\s\S]*?)\s*```$/i;
  const codeBlockMatch = answerContent.match(codeBlockRegex);
  if (codeBlockMatch) {
    answerContent = codeBlockMatch[1].trim();
  }

  const firstBrace = answerContent.indexOf("{");
  const lastBrace = answerContent.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    answerContent = answerContent.slice(firstBrace, lastBrace + 1);
  }

  try {
    const parsed = JSON.parse(answerContent);
    return parsed;
  } catch (err) {
    console.warn("Ошибка парсинга JSON, вероятно OpenAI вернул текст:", err);
    return { material: answerContent, answers: "", comments: "" };
  }
}

// Эндпоинт для создания нового потока (thread) с указанием учебников через текст
app.post('/api/create-thread', async (req, res) => {
  try {
    const { eduLang, classLevel, subjectCode, author } = req.body;
    // Получаем имена учебников (например, ["GEO_10_EMN_KAZ_2019_Телепбекова С.К._1", "GEO_10_EMN_KAZ_2019_Телепбекова С.К._2"])
    const textbookFileNames = getAllTextbookFiles(eduLang, classLevel, subjectCode, author);
    
    // Создаём поток через API OpenAI
    const threadResponse = await fetch('https://api.openai.com/v1/threads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'OpenAI-Beta': 'assistants=v2'
      }
    });

    if (!threadResponse.ok) {
      const errData = await threadResponse.json();
      console.error("Error creating thread:", errData);
      return res.status(500).json({ 
        error: errData.error?.message || "Error creating thread",
        details: errData
      });
    }

    const threadData = await threadResponse.json();
    
    // Формируем начальное сообщение – включаем список учебников в текст
    let initialContent = 'Начало сеанса для генерации тестов.';
    if (textbookFileNames.length > 0) {
      initialContent = `Учебники: ${textbookFileNames.join(', ')}\n${initialContent}`;
    }

    const messageResponse = await fetch(`https://api.openai.com/v1/threads/${threadData.id}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({
        role: "user",
        content: initialContent
      })
    });

    if (!messageResponse.ok) {
      const errData = await messageResponse.json();
      console.error("Error adding message:", errData);
      return res.status(500).json({ 
        error: errData.error?.message || "Error adding message to thread",
        details: errData
      });
    }

    return res.json({ thread_id: threadData.id });
  } catch (error) {
    console.error("Exception in /api/create-thread:", error);
    return res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Маршрут для отправки сообщений на OpenAI API (без изменений)
app.post('/api/send-message', async (req, res) => {
    const { chatMessage, workspaceContent } = req.body;

    const data = {
        model: "gpt-4o",
        messages: [
            { role: "system", content: "You are a helpful assistant." },
            { role: "user", content: `Workspace: "${workspaceContent}"\nMessage: "${chatMessage}"` }
        ]
    };

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('OpenAI API Error:', errorData);
            throw new Error(errorData.error?.message || 'OpenAI API Error');
        }

        const result = await response.json();
        res.json(result);
    } catch (error) {
        console.error('Ошибка при отправке сообщения:', error);
        res.status(500).json({ error: error.message || 'Ошибка при отправке сообщения' });
    }
});

/**
 * Эндпоинт для генерации теста.
 * Если передан thread_id – отправляем промпт в созданный поток.
 * При создании run добавляем параметр tool_choice с типом "file_search"
 */
app.post('/api/generate-test', async (req, res) => {
  try {
    const {
      eduLang, classLevel, subjectCode, subjectName, author, theme,
      difficultyLevel, customSettings, testConstructor, thread_id
    } = req.body;

    // Получаем имена учебников (просто строки, без дополнительных полей)
    const textbookFileNames = getAllTextbookFiles(eduLang, classLevel, subjectCode, author);
    const promptParams = { eduLang, classLevel, subjectCode, subjectName, author, theme, difficultyLevel, customSettings, testConstructor };
    const prompt = buildPrompt(promptParams, textbookFileNames);
    
    let gptRawAnswer;

    if (thread_id) {
      console.log("Используем thread_id:", thread_id);

      // Отправляем сообщение в поток без прикрепления file_id
      const messageResponse = await fetch(`https://api.openai.com/v1/threads/${thread_id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'OpenAI-Beta': 'assistants=v2'
        },
        body: JSON.stringify({
          role: "user",
          content: prompt
        })
      });

      if (!messageResponse.ok) {
        const errData = await messageResponse.json();
        console.error("Ошибка при отправке сообщения в поток:", errData);
        throw new Error(errData.error?.message || "Ошибка при отправке сообщения в поток");
      }

      // Создаём run с указанием инструмента file_search
      const runResponse = await fetch(`https://api.openai.com/v1/threads/${thread_id}/runs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'OpenAI-Beta': 'assistants=v2'
        },
        body: JSON.stringify({
          assistant_id: process.env.OPENAI_ASSISTANT_ID,
          instructions: prompt,
          tool_choice: { type: "file_search" }
        })
      });

      if (!runResponse.ok) {
        const errData = await runResponse.json();
        console.error("Ошибка при создании run:", errData);
        throw new Error(errData.error?.message || "Ошибка при создании run");
      }

      const runData = await runResponse.json();
      const run_id = runData.id;
      console.log("Создан run:", run_id);

      // Ждём результат через pollRunResult
      gptRawAnswer = await pollRunResult(thread_id, run_id);
    } else {
      console.log("Используем обычный API OpenAI");
      gptRawAnswer = await callOpenAI(prompt);
    }

    const parsed = parseAIResponse(gptRawAnswer);

    const material = parsed.material || "";
    const answers = parsed.answers || "";
    const comments = parsed.comments || "";

    return res.json({ material, answers, comments });
  } catch (error) {
    console.error('Ошибка в /api/generate-test:', error);
    return res.status(500).json({ error: 'Ошибка при генерации теста: ' + error.message });
  }
});

// Middleware для проверки авторизации только для API запросов
app.use('/api', (req, res, next) => {
    // Временно пропускаем все запросы без проверки токена
    return next();
    
    /* Закомментированный код проверки токена
    if (req.path.startsWith('/auth/login') || 
        req.path.startsWith('/auth/register')) {
        return next();
    }

    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ 
            success: false, 
            message: 'Не авторизован' 
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ 
            success: false, 
            message: 'Недействительный токен' 
        });
    }
    */
});

// API маршруты
app.use('/api/auth', authRoutes);

// Маршрут для всех остальных запросов (SPA)
app.get('*', (req, res, next) => {
    if (req.path.includes('.')) {
        return next();
    }
    
    const publicPaths = ['/login', '/register'];
    const isPublicPath = publicPaths.some(p => req.path.startsWith(p));

    if (isPublicPath) {
        return res.sendFile(path.join(__dirname, '../../login.html'));
    }

    const playgroundPaths = ['/playground'];
    const isPlaygroundPath = playgroundPaths.some(p => req.path.startsWith(p));

    if (isPlaygroundPath) {
        return res.sendFile(path.join(__dirname, '../../index.html'));
    }

    res.sendFile(path.join(__dirname, '../../index.html'));
});

let httpsServer;

try {
    const privateKey = fs.readFileSync('/etc/letsencrypt/live/aitalim.kz/privkey.pem', 'utf8');
    const certificate = fs.readFileSync('/etc/letsencrypt/live/aitalim.kz/cert.pem', 'utf8');
    const ca = fs.readFileSync('/etc/letsencrypt/live/aitalim.kz/chain.pem', 'utf8');

    const credentials = {
        key: privateKey,
        cert: certificate,
        ca: ca
    };

    httpsServer = https.createServer(credentials, app);
} catch (error) {
    console.log('SSL сертификаты не найдены, запуск только HTTP сервера');
}

// Экспортируем app и httpsServer
export { app, httpsServer };
