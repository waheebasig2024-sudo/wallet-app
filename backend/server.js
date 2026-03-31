// ============================================
// محفظة المفيد نت - الخادم الرئيسي (Node.js)
// تم حل مشكلة مسارات المجلدات (Views Lookup Error)
// ============================================

require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// ========== إعداد المسارات (هذا الجزء هو حل المشكلة) ==========

// تأكد أن مجلد الـ views موجود في المجلد الرئيسي للمشروع
app.set('views', path.join(__dirname, 'views')); 
app.set('view engine', 'ejs');

// تأكد أن المجلد العام للملفات الثابتة موجود
app.use(express.static(path.join(__dirname, 'public')));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// إعداد الجلسات
app.use(session({
    secret: process.env.SESSION_SECRET || 'wallet_secret_2026',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

// ========== قاعدة البيانات (داخل مجلد database) ==========
const dbPath = path.join(__dirname, 'database', 'wallet.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        phone TEXT UNIQUE,
        password TEXT,
        wallet_balance REAL DEFAULT 0,
        device_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS wallet_charges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT, amount REAL, transaction_id TEXT, method TEXT,
        status TEXT DEFAULT 'pending', created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS gift_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT, cost REAL, request_type TEXT, voucher_code TEXT,
        status TEXT DEFAULT 'completed', created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

// التحقق من تسجيل الدخول
const checkAuth = (req, res, next) => {
    if (req.session.user) return next();
    res.redirect('/');
};

// ========== المسارات (Routes) ==========

// صفحة الدخول
app.get('/', (req, res) => {
    if (req.session.user) return res.redirect('/dashboard');
    res.render('index', { error: null });
});

// معالجة الدخول
app.post('/login', (req, res) => {
    const { phone, password } = req.body;
    db.get('SELECT * FROM users WHERE phone = ?', [phone], async (err, user) => {
        if (user && await bcrypt.compare(password, user.password)) {
            req.session.user = user;
            res.redirect('/dashboard');
        } else {
            res.render('index', { error: '❌ رقم الهاتف أو كلمة المرور غير صحيحة' });
        }
    });
});

// لوحة التحكم
app.get('/dashboard', checkAuth, (req, res) => {
    db.get('SELECT * FROM users WHERE id = ?', [req.session.user.id], (err, user) => {
        res.render('dashboard', { user });
    });
});

// التسجيل
app.get('/register', (req, res) => res.render('register'));

app.post('/api/register', async (req, res) => {
    const { name, phone, password, device_id } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    db.run('INSERT INTO users (name, phone, password, device_id) VALUES (?, ?, ?, ?)', 
    [name, phone, hashedPassword, device_id], (err) => {
        if (err) return res.json({ error: 'رقم الهاتف مسجل مسبقاً' });
        res.json({ success: true });
    });
});

// الشحن
app.get('/charge', checkAuth, (req, res) => res.render('charge', { user: req.session.user }));

app.post('/api/charge', checkAuth, (req, res) => {
    const { amount, transaction_id, method } = req.body;
    db.run('INSERT INTO wallet_charges (phone, amount, transaction_id, method) VALUES (?, ?, ?, ?)',
    [req.session.user.phone, amount, transaction_id, method], (err) => {
        if (err) return res.json({ error: 'خطأ في الطلب' });
        res.json({ success: true });
    });
});

// الشراء
app.get('/buy', checkAuth, (req, res) => {
    db.get('SELECT * FROM users WHERE id = ?', [req.session.user.id], (err, user) => {
        res.render('buy', { user });
    });
});

app.post('/api/buy', checkAuth, (req, res) => {
    const { card_name, price } = req.body;
    db.get('SELECT * FROM users WHERE id = ?', [req.session.user.id], (err, user) => {
        if (user.wallet_balance < price) return res.json({ error: 'رصيدك غير كافٍ' });
        const voucher = uuidv4().substring(0, 8).toUpperCase();
        db.run('UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?', [price, user.id], () => {
            db.run('INSERT INTO gift_requests (phone, cost, request_type, voucher_code) VALUES (?, ?, ?, ?)',
            [user.phone, price, card_name, voucher], () => {
                res.json({ success: true, voucherCode: voucher, cardType: price });
            });
        });
    });
});

// السجل
app.get('/history', checkAuth, (req, res) => {
    const phone = req.session.user.phone;
    db.all(`SELECT 'شحن' as type, amount, status, created_at, transaction_id as ref FROM wallet_charges WHERE phone = ?
            UNION ALL 
            SELECT 'شراء' as type, cost as amount, status, created_at, request_type as ref FROM gift_requests WHERE phone = ?
            ORDER BY created_at DESC`, [phone, phone], (err, rows) => {
        res.render('history', { transactions: rows || [] });
    });
});

// الخروج
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// السوكيت للإشعارات
io.on('connection', (socket) => {
    socket.on('register-user', (userId) => { socket.join(`user_${userId}`); });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`الخادم يعمل على: http://localhost:${PORT}`));
