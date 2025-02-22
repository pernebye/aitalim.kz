// neurolab-backend/src/server.js

import { app, httpsServer } from './app.js';

const PORT = process.env.PORT || 3000;

if (httpsServer) {
    httpsServer.listen(443, () => {
        console.log('HTTPS Сервер запущен на порту 443');
    });
    
    // Редирект с HTTP на HTTPS
    app.listen(80, () => {
        console.log('HTTP->HTTPS редирект запущен на порту 80');
    });
} else {
    app.listen(PORT, () => {
        console.log(`Сервер запущен на порту ${PORT}`);
    });
}