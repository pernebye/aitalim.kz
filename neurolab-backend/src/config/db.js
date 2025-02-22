// neurolab-backend/src/config/db.js

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();  // <-- обязательно до использования process.env

const { Pool } = pg;

export const pool = new Pool({
    user: process.env.DB_USER,      // строка из .env
    host: process.env.DB_HOST,      // строка из .env
    database: process.env.DB_NAME,  // строка из .env
    password: process.env.DB_PASSWORD, // строка из .env
    port: process.env.DB_PORT       // число, можете добавить parseInt при необходимости
});