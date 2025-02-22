// neurolab-backend\src\controllers\auth.js

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { pool } from '../config/db.js';
import { OAuth2Client } from 'google-auth-library';


const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const register = async (req, res) => {
    try {
        const { email, password, firstName, lastName, middleName, birthDate, city, phone } = req.body;
        
        // Подробное логирование
        console.log('=== Регистрация нового пользователя ===');
        console.log('Headers:', req.headers);
        console.log('Body:', req.body);
        
        // Проверка наличия обязательных полей
        if (!email || !password || !firstName || !lastName || !birthDate || !city || !phone) {
            console.log('Отсутствуют обязательные поля:', { 
                email: !!email, 
                password: !!password, 
                firstName: !!firstName, 
                lastName: !!lastName, 
                birthDate: !!birthDate, 
                city: !!city, 
                phone: !!phone 
            });
            return res.status(400).json({ 
                success: false,
                message: 'Пожалуйста, заполните все обязательные поля' 
            });
        }

        // Проверка существования пользователя
        const userExists = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (userExists.rows.length > 0) {
            console.log('Пользователь уже существует:', email);
            return res.status(400).json({ 
                success: false,
                message: 'Пользователь с таким email уже существует' 
            });
        }

        // Хеширование пароля и создание пользователя
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = await pool.query(
            `INSERT INTO users (
                email, 
                password, 
                first_name, 
                last_name, 
                middle_name, 
                birth_date, 
                city, 
                phone
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [
                email, 
                hashedPassword, 
                firstName, 
                lastName, 
                middleName || null,
                birthDate, 
                city, 
                phone
            ]
        );

        // Создание JWT токена
        const token = jwt.sign(
            { id: newUser.rows[0].id },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        console.log('Пользователь успешно создан:', newUser.rows[0].id);

        res.status(201).json({
            success: true,
            token,
            user: {
                id: newUser.rows[0].id,
                email: newUser.rows[0].email,
                firstName: newUser.rows[0].first_name,
                lastName: newUser.rows[0].last_name,
                phone: newUser.rows[0].phone
            }
        });
    } catch (error) {
        console.error('Ошибка регистрации:', error);
        res.status(500).json({ 
            success: false,
            message: error.message || 'Ошибка сервера при регистрации'
        });
    }
};

export const googleAuth = async (req, res) => {
    try {
        const { credential, email, firstName, lastName, picture } = req.body;
        
        // Проверяе, существует л пользователь
        const userExists = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        let user;
        let isNewUser = false;

        if (userExists.rows.length === 0) {
            // Создаем нового пользователя
            const newUser = await pool.query(
                `INSERT INTO users (
                    email, 
                    first_name, 
                    last_name,
                    google_id,
                    profile_picture,
                    is_google_user
                ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                [
                    email,
                    firstName,
                    lastName,
                    credential,
                    picture,
                    true
                ]
            );
            user = newUser.rows[0];
            isNewUser = true;
        } else {
            user = userExists.rows[0];
            // Обновляем данные пользователя
            await pool.query(
                `UPDATE users SET 
                    google_id = $1,
                    profile_picture = $2,
                    is_google_user = true
                WHERE email = $3`,
                [credential, picture, email]
            );
        }

        // Создаем JWT токен
        const token = jwt.sign(
            { id: user.id },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(200).json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                picture: user.profile_picture,
                isNewUser
            }
        });
    } catch (error) {
        console.error('Ошибка Google аутентификации:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка при аутентификации через Google'
        });
    }
};

export const login = async (req, res) => {
    console.log('Получен запрос на логин:', req.body);
    try {
        const { email, password } = req.body;

        // Проверяем наличие пользователя
        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Неверный email или пароль'
            });
        }

        const user = result.rows[0];

        // Проверяем пароль
        const isValidPassword = await bcrypt.compare(password, user.password);

        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Неверный email или пароль'
            });
        }

        // Создаем JWT токен
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                picture: user.profile_picture
            }
        });

    } catch (error) {
        console.error('Ошибка при авторизации:', error);
        res.status(500).json({
            success: false,
            message: 'Внутренняя ошибка сервера'
        });
    }
};