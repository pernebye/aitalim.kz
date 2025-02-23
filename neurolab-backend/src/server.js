// neurolab-backend/src/server.js

import { app, httpsServer } from './app.js';

const PORT = process.env.PORT || 3001;

// Добавляем обработку ошибок при запуске сервера
const startServer = () => {
    if (httpsServer) {
        try {
            httpsServer.listen(443, () => {
                console.log('HTTPS Сервер запущен на порту 443');
            });
            
            // Редирект с HTTP на HTTPS
            app.listen(80, () => {
                console.log('HTTP->HTTPS редирект запущен на порту 80');
            });
        } catch (error) {
            console.error('Ошибка при запуске HTTPS сервера:', error);
            process.exit(1);
        }
    } else {
        try {
            const server = app.listen(PORT, () => {
                console.log(`Сервер запущен на порту ${PORT}`);
            });

            // Обработка ошибокss
            server.on('error', (error) => {
                if (error.code === 'EADDRINUSE') {
                    console.error(`Порт ${PORT} уже используется`);
                    process.exit(1);
                }
                console.error('Ошибка сервера:', error);
                process.exit(1);
            });
        } catch (error) {
            console.error('Ошибка при запуске HTTP сервера:', error);
            process.exit(1);
        }
    }
};

startServer(); 