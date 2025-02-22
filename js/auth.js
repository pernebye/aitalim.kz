// js/auth.js

const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000'
    : 'https://aitalim.kz';

function validatePassword(password) {
    const minLength = 8;

    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    
    const errors = [];
    
    if (password.length < minLength) {
        errors.push('Минимум 8 символов');
    }
    if (!hasUpperCase) {
        errors.push('Минимум 1 заглавная буква');
    }
    if (!hasLowerCase) {
        errors.push('Минимум 1 строчная буква');
    }
    if (!hasNumbers) {
        errors.push('Минимум 1 цифра');
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}
// Ждем загрузки Google API
function waitForGoogleScript() {
    if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
        initializeGoogleSignIn();
    } else {
        setTimeout(waitForGoogleScript, 100);
    }
}

function initializeGoogleSignIn() {
    google.accounts.id.initialize({
        client_id: "688250717742-vhg8e8bh68i7nsidgh9brbjgidqd7q3t.apps.googleusercontent.com",
        callback: handleGoogleSignIn,
        auto_select: false,
        cancel_on_tap_outside: true
    });

    google.accounts.id.renderButton(
        document.getElementById("g_id_signin"),
        { 
            type: "standard",
            theme: "outline",
            size: "large",
            text: "continue_with",
            shape: "rectangular",
            width: 400
        }
    );
}

// Общая функция инициализации кнопки переключения пароля
function initializePasswordToggle(formSelector) {
    const passwordButton = document.querySelector(`${formSelector} .password-toggle`);
    if (passwordButton) {
        passwordButton.setAttribute('data-visible', 'false');

        passwordButton.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const isVisible = this.getAttribute('data-visible') === 'true';
            const slashLine = this.querySelector('.eye-slash');
            
            // Находим оба поля пароля
            const passwordInput = document.querySelector(`${formSelector} #password`);
            const confirmPasswordInput = document.querySelector(`${formSelector} #confirm-password`);

            slashLine.style.transition = 'none';
            
            if (isVisible) {
                slashLine.style.strokeDashoffset = '0';
                slashLine.getBoundingClientRect();
                slashLine.style.transition = 'stroke-dashoffset 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
                slashLine.style.strokeDashoffset = '-21';
                passwordInput.type = 'password';
                if (confirmPasswordInput) {
                    confirmPasswordInput.type = 'password';
                }
            } else {
                slashLine.style.strokeDashoffset = '21';
                slashLine.getBoundingClientRect();
                slashLine.style.transition = 'stroke-dashoffset 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
                slashLine.style.strokeDashoffset = '0';
                passwordInput.type = 'text';
                if (confirmPasswordInput) {
                    confirmPasswordInput.type = 'text';
                }
            }

            this.setAttribute('data-visible', (!isVisible).toString());
        });
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // === Общий код для всех страниц (логин, регистрация, переводчик, Google Sign-In и т.д.) ===
    waitForGoogleScript();

    // Если на странице логина:
    const isLoginPage = window.location.pathname.includes('login');
    if (isLoginPage) {
        initializePasswordToggle('.login-form');
        const loginForm = document.querySelector('.auth-form.login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                const email = document.getElementById('email').value;
                const password = document.getElementById('password').value;

                try {
                    console.log('Отправка запроса на:', API_URL + '/api/auth/login');
                    const response = await fetch(API_URL + '/api/auth/login', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ email, password })
                    });
                    console.log('Статус ответа:', response.status);
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    const data = await response.json();
                    console.log('Данные ответа:', data);
                    if (data.success) {
                        localStorage.setItem('token', data.token);
                        localStorage.setItem('user', JSON.stringify(data.user));
                        window.location.replace('/index.html');
                    } else {
                        alert(data.message || 'Ошибка при входе в систему');
                    }
                } catch (error) {
                    console.error('Подробности ошибки:', error);
                    alert('Произошла ошибка при попытке входа');
                }
            });
        }
    }

    // Если на странице регистрации:
    const isRegisterPage = window.location.pathname.includes('register');
    if (isRegisterPage) {
        initializePasswordToggle('.register-form');
        initializeDateSelects();
        setInputAnimationDelays();
    }

    // === Обработчики для регистрации ===
    const step1Form = document.getElementById('step1Form');
    if (step1Form) {
        step1Form.addEventListener('submit', function(e) {
            e.preventDefault();
            const password = document.getElementById('password').value;
            const validation = validatePassword(password);
            
            if (!validation.isValid) {
                alert('Пароль не соответствует требованиям');
                return;
            }
            
            registrationData.email = document.getElementById('email').value;
            registrationData.password = password;

            const confirmPassword = document.getElementById('confirm-password').value;
            if (registrationData.password !== confirmPassword) {
                alert('Пароли не совпадают');
                return;
            }

            document.querySelector('.step-1').classList.add('prev');
            document.querySelector('.step-1').classList.remove('active');
            document.querySelector('.step-2').classList.add('active');
        });
    }

    const step2Form = document.getElementById('step2Form');
    if (step2Form) {
        step2Form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            registrationData.lastName = document.getElementById('lastname').value;
            registrationData.firstName = document.getElementById('firstname').value;
            registrationData.middleName = document.getElementById('middlename').value;

            document.querySelector('.step-2').classList.add('prev');
            document.querySelector('.step-2').classList.remove('active');
            document.querySelector('.step-3').classList.add('active');
            document.querySelector('.auth-box').classList.remove('step3-active');
        });
    }

    const step3Form = document.getElementById('step3Form');
    if (step3Form) {
        step3Form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const verificationCode = document.getElementById('verification-code').value;
            if (verificationCode !== '7777') {
                alert('Неверный код подтверждения');
                return;
            }
            
            const year = document.getElementById('birth-year').value;
            const month = document.getElementById('birth-month').value.padStart(2, '0');
            const day = document.getElementById('birth-day').value.padStart(2, '0');
            registrationData.birthDate = `${year}-${month}-${day}`;

            registrationData.city = document.getElementById('city').value;
            registrationData.phone = document.getElementById('phone').value;

            console.log('Отправляемые данные:', registrationData);

            try {
                const response = await fetch(API_URL + '/api/auth/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify(registrationData)
                });

                console.log('Статус ответа:', response.status);
                const contentType = response.headers.get('content-type');
                let data;
                try {
                    data = await response.json();
                } catch (e) {
                    data = await response.text();
                }
                console.log('Ответ сервера:', data);

                if (!response.ok) {
                    throw new Error(data.message || 'Ошибка при регистрации');
                }

                if (data.success) {
                    localStorage.setItem('token', data.token);
                    window.location.href = '/';
                } else {
                    alert(data.message || 'Ошибка регистрации');
                }
            } catch (error) {
                console.error('Подробности ошибки:', error);
                console.error('Данные при ошибке:', registrationData);
                alert(error.message || 'Произошла ошибка при регистрации');
            }
        });
    }

    const phoneInput = document.getElementById('phone');
    if (phoneInput) {
        phoneInput.addEventListener('input', function() {
            const verificationGroup = document.querySelector('.verification-group');
            const authBox = document.querySelector('.auth-box');
            const formSteps = document.querySelector('.form-steps');
            const authForm = document.querySelector('.step-3 .auth-form');
            const registerButton = document.getElementById('register-button');
            
            const phoneNumber = this.value.replace(/\D/g, '');
            const isValidKZPhone = /^(?:7|8)\d{10}$/.test(phoneNumber);
            
            if (isValidKZPhone) {
                verificationGroup.style.display = 'block';
                authBox.style.minHeight = '550px';
                formSteps.style.minHeight = '395px';
                authForm.style.minHeight = '395px';
                registerButton.style.marginTop = '0';
            } else {
                verificationGroup.style.display = 'none';
                authBox.style.minHeight = '500px';
                formSteps.style.minHeight = '300px';
                authForm.style.minHeight = '300px';
                registerButton.style.marginTop = '16px';
            }
        });
    }

    const verificationCodeInput = document.getElementById('verification-code');
    if (verificationCodeInput) {
        verificationCodeInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                document.querySelector('.verify-button')?.click();
            }
        });
    }

    const verifyButton = document.querySelector('.verify-button');
    if (verifyButton) {
        verifyButton.addEventListener('click', function() {
            const code = document.getElementById('verification-code').value;
            if (code === '7777') {
                this.textContent = 'Подтверждено';
                this.style.background = '#4CAF50';
                this.disabled = true;
                document.getElementById('verification-code').disabled = true;
                document.getElementById('register-button').disabled = false;
            } else {
                alert('Неверный код подтверждения');
            }
        });
    }

    if (step3Form) {
        step3Form.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !document.getElementById('register-button')?.disabled) {
                e.preventDefault();
                document.getElementById('register-button')?.click();
            }
        });
    }
});

let registrationData = {};

function initializeDateSelects() {
    const daySelect = document.getElementById('birth-day');
    
    for (let i = 1; i <= 31; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = i < 10 ? `0${i}` : i;
        daySelect.appendChild(option);
    }
}

document.getElementById('step1Form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const password = document.getElementById('password').value;
    const validation = validatePassword(password);
    
    if (!validation.isValid) {
        alert('Пароль не соответствует требованиям');
        return;
    }
    
    registrationData.email = document.getElementById('email').value;
    registrationData.password = password;

    const confirmPassword = document.getElementById('confirm-password').value;
    if (registrationData.password !== confirmPassword) {
        alert('Пароли не совпадают');
        return;
    }

    document.querySelector('.step-1').classList.add('prev');
    document.querySelector('.step-1').classList.remove('active');
    document.querySelector('.step-2').classList.add('active');
});

document.getElementById('step2Form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    registrationData.lastName = document.getElementById('lastname').value;
    registrationData.firstName = document.getElementById('firstname').value;
    registrationData.middleName = document.getElementById('middlename').value;

    document.querySelector('.step-2').classList.add('prev');
    document.querySelector('.step-2').classList.remove('active');
    document.querySelector('.step-3').classList.add('active');
    document.querySelector('.auth-box').classList.remove('step3-active');
});

document.getElementById('step3Form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const verificationCode = document.getElementById('verification-code').value;
    if (verificationCode !== '7777') {
        alert('Неверный код подтверждения');
        return;
    }
    
    const year = document.getElementById('birth-year').value;
    const month = document.getElementById('birth-month').value.padStart(2, '0');
    const day = document.getElementById('birth-day').value.padStart(2, '0');
    registrationData.birthDate = `${year}-${month}-${day}`;

    registrationData.city = document.getElementById('city').value;
    registrationData.phone = document.getElementById('phone').value;

    console.log('Отправляемые данные:', registrationData);

    try {
        const response = await fetch(API_URL + '/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(registrationData)
        });

        console.log('Статус ответа:', response.status);
        
        const contentType = response.headers.get('content-type');
        let data;
        
        try {
            data = await response.json();
        } catch (e) {
            data = await response.text();
        }
        
        console.log('Ответ сервера:', data);

        if (!response.ok) {
            throw new Error(data.message || 'Ошибка при регистрации');
        }

        if (data.success) {
            localStorage.setItem('token', data.token);
            window.location.href = '/';
        } else {
            alert(data.message || 'Ошибка регистации');
        }
    } catch (error) {
        console.error('Подробности шибки:', error);
        console.error('Данные при ошибке:', registrationData);
        alert(error.message || 'Произошла ошибка при регистрации');
    }
});

document.getElementById('phone').addEventListener('input', function() {
    const verificationGroup = document.querySelector('.verification-group');
    const authBox = document.querySelector('.auth-box');
    const formSteps = document.querySelector('.form-steps');
    const authForm = document.querySelector('.step-3 .auth-form');
    const registerButton = document.getElementById('register-button');
    
    const phoneNumber = this.value.replace(/\D/g, '');
    const isValidKZPhone = /^(?:7|8)\d{10}$/.test(phoneNumber);
    
    if (isValidKZPhone) {
        verificationGroup.style.display = 'block';
        authBox.style.minHeight = '550px';
        formSteps.style.minHeight = '395px';
        authForm.style.minHeight = '395px';
        registerButton.style.marginTop = '0';
    } else {
        verificationGroup.style.display = 'none';
        authBox.style.minHeight = '500px';
        formSteps.style.minHeight = '300px';
        authForm.style.minHeight = '300px';
        registerButton.style.marginTop = '16px';
    }
});

document.getElementById('verification-code').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        document.querySelector('.verify-button').click();
    }
});

document.querySelector('.verify-button').addEventListener('click', function() {
    const code = document.getElementById('verification-code').value;
    if (code === '7777') {
        this.textContent = 'Подтверждено';
        this.style.background = '#4CAF50';
        this.disabled = true;
        document.getElementById('verification-code').disabled = true;
        document.getElementById('register-button').disabled = false;
    } else {
        alert('Неверный код подтвержденя');
    }
});

document.getElementById('step3Form').addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && !document.getElementById('register-button').disabled) {
        e.preventDefault();
        document.getElementById('register-button').click();
    }
});

function setInputAnimationDelays() {
    const steps = document.querySelectorAll('.step');
    steps.forEach(step => {
        const inputs = step.querySelectorAll('.input-group, .birth-date-group, .verification-group');
        inputs.forEach((input, index) => {
            input.style.setProperty('--index', index);
        });
    });
}

function handleGoogleSignIn(response) {
    if (!response.credential) {
        console.error('Не удалось получить учетные данные Google');
        return;
    }

    try {
        // Декодируем JWT токен безопасным способом
        const parts = response.credential.split('.');
        if (parts.length !== 3) {
            throw new Error('Неверный формат JWT токена');
        }

        // Добавляем padding если необходимо
        const base64Url = parts[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const padding = base64.length % 4;
        const paddedBase64 = padding ? base64 + '='.repeat(4 - padding) : base64;

        const payload = JSON.parse(atob(paddedBase64));
        
        const userData = {
            credential: response.credential,
            email: payload.email,
            firstName: payload.given_name,
            lastName: payload.family_name,
            picture: payload.picture
        };

        const endpoint = API_URL + '/api/auth/google';

        fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(userData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify({
                    email: userData.email,
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                    picture: userData.picture
                }));
                window.location.href = '/index.html';
            } else {
                throw new Error(data.message || 'Ошибка авторизации через Google');
            }
        })
        .catch(error => {
            console.error('Ошибка авторизации через Google:', error);
            alert('Произошла ошибка при авторизации через Google: ' + error.message);
        });
    } catch (error) {
        console.error('Ошибка при обработке JWT:', error);
        alert('Ошибка при обработке данных от Google');
    }
}

window.addEventListener('load', function() {
    // Временно отключаем проверку токена
    /*
    const token = localStorage.getItem('token');
    const isAuthPage = window.location.pathname.includes('login') || 
                      window.location.pathname.includes('register');

    if (!token && !isAuthPage) {
        window.location.replace('/login.html');
        return;
    }
    */
});

