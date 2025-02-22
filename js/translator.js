class Translator {
    constructor() {
        this.translations = {};
        this.currentLang = localStorage.getItem('language') || 'ru';
        this.loadTranslations(this.currentLang);
        
        // Инициализируем правильное состояние при загрузке
        document.addEventListener('DOMContentLoaded', () => {
            this.initializeLanguageState();
        });
    }

    initializeLanguageState() {
        const langCurrent = document.querySelector('.lang-current');
        const langOptions = document.querySelector('.lang-options');
        
        if (langCurrent && langOptions) {
            // Устанавливаем текущий язык в закладке
            langCurrent.textContent = this.currentLang.toUpperCase();
            
            // Получаем все опции языков
            const options = Array.from(langOptions.querySelectorAll('.lang-option'));
            
            // Находим текущий язык среди опций
            const currentOption = options.find(opt => opt.getAttribute('data-lang') === this.currentLang);
            
            if (currentOption) {
                // Перемещаем текущий язык в конец (правую позицию)
                langOptions.appendChild(currentOption);
                
                // Делаем его некликабельным
                currentOption.classList.add('current-lang');
                currentOption.onclick = null;
                currentOption.style.cursor = 'default';
                
                // Устанавливаем обработчики для остальных опций
                options.forEach(option => {
                    if (option !== currentOption) {
                        option.onclick = async () => {
                            await this.setLanguage(option.getAttribute('data-lang'));
                        };
                        option.classList.remove('current-lang');
                        option.style.cursor = 'pointer';
                    }
                });
            }
        }
    }

    async setLanguage(lang) {
        if (lang === this.currentLang) return; // Игнорируем клик по текущему языку
        
        if (!this.translations[lang]) {
            await this.loadTranslations(lang);
        }
        
        const oldLang = this.currentLang;
        this.currentLang = lang;
        localStorage.setItem('language', lang);
        
        const langCurrent = document.querySelector('.lang-current');
        const langOptions = document.querySelector('.lang-options');
        
        if (langCurrent && langOptions) {
            // Плавно скрываем элементы
            langCurrent.style.transition = 'opacity 0.3s ease';
            langCurrent.style.opacity = '0';
            
            // Находим опции для обмена
            const selectedOption = langOptions.querySelector(`[data-lang="${lang}"]`);
            const lastOption = langOptions.querySelector(`[data-lang="${oldLang}"]`);
            
            if (selectedOption && lastOption) {
                // Анимация исчезновения
                selectedOption.style.transition = 'all 0.3s ease';
                lastOption.style.transition = 'all 0.3s ease';
                selectedOption.style.opacity = '0';
                lastOption.style.opacity = '0';
                
                setTimeout(() => {
                    // Обновляем текущий язык в закладке
                    langCurrent.textContent = lang.toUpperCase();
                    
                    // Меняем местами опции
                    langOptions.insertBefore(lastOption, selectedOption);
                    langOptions.appendChild(selectedOption);
                    
                    // Обновляем классы и обработчики
                    selectedOption.classList.add('current-lang');
                    selectedOption.onclick = null;
                    selectedOption.style.cursor = 'default';
                    
                    lastOption.classList.remove('current-lang');
                    lastOption.onclick = async () => {
                        await this.setLanguage(oldLang);
                    };
                    lastOption.style.cursor = 'pointer';
                    
                    // Анимация появления
                    setTimeout(() => {
                        langCurrent.style.opacity = '1';
                        selectedOption.style.opacity = '1';
                        lastOption.style.opacity = '1';
                    }, 50);
                }, 300);
            }
        }
        
        this.updatePageTranslations();
    }

    async loadTranslations(lang) {
        try {
            const response = await fetch(`/locales/${lang}.json`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            this.translations[lang] = await response.json();
        } catch (error) {
            console.error('Error loading translations:', error);
        }
    }

    updatePageTranslations() {
        document.querySelectorAll('[data-translate]').forEach(element => {
            const key = element.getAttribute('data-translate');
            if (this.translations[this.currentLang] && this.translations[this.currentLang][key]) {
                element.textContent = this.translations[this.currentLang][key];
            }
        });
    }
}

// Инициализация переводчика
const translator = new Translator();