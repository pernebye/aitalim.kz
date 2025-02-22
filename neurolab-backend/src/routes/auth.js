// neurolab-backend/src/routes/auth.js

import express from 'express';
import jwt from 'jsonwebtoken';
import { login, register, googleAuth } from '../controllers/auth.js';


const router = express.Router();

// Добавим логирование
router.use((req, res, next) => {
    console.log('Auth Route:', req.method, req.path);
    next();
});

// Маршруты аутентификации
router.post('/login', login);
router.post('/register', register);
router.post('/google', googleAuth);

export default router;