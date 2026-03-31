// ============================================
// محفظة المفيد نت - الخادم الرئيسي (Node.js)
// تم التصحيح ليتوافق مع توزيع المجلدات والأكواد الأصلية
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
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// ========== الإعدادات (تحديد المسارات بناءً على صورك) ==========

// 1. تحديد مجلد القوالب (Views) - الملفات مثل index.ejs و dashboard.ejs
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// 2. تحديد مجلد الملفات العامة (CSS, Images, JS)
app.use(express.static(path.join(__dirname, 'public')));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// 3. إعداد الجلسات (Sessions)
app.use(session({
  secret: process.env.SESSION_SECRET || 'wallet_session_secure_key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 } // 7 أيام
}));

// ========== قاعدة البيانات (داخل مجلد database) ==========
const dbPath = path.join(__dirname, 'database', 'wallet.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error("خطأ في فتح قاعدة البيانات:", err.message);
    else console.log("✅ متصل بقاعدة البيانات بنجاح");
});

db.serialize(() => {
  // جدول المستخدمين
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    phone TEXT UNIQUE,
    password TEXT,
    wallet_balance REAL DEFAULT 0,
    device_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // جدول طلبات الشحن
  db.run(`CREATE TABLE IF NOT EXISTS wallet_charges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT,
    amount REAL,
    transaction_id TEXT,
    method TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // جدول طلبات الكروت (الهدايا)
  db.run(`CREATE TABLE IF NOT EXISTS gift_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT,
    cost REAL,
    request_type TEXT,
    voucher_code TEXT,
    status TEXT DEFAULT 'completed',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// ========== الحماية (Middleware) ==========
const isAuthenticated = (req, res, next) => {
  if (req.session.user) return next();
  res.redirect('/');
};

// ========== المسارات (Routes) ==========

// 1. الصفحة الرئيسية (Login)
app.get('/', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('index', { error: null });
});

// 2. معالجة تسجيل الدخول
app.post('/login', (req, res) => {
  const { phone, password } = req.body;
  db.get('SELECT * FROM users WHERE phone = ?', [phone], async (err, user) => {
    if (err) return res.render('index', { error: '❌ خطأ في قاعدة البيانات' });
    if (user && await bcrypt.compare(password, user.password)) {
      req.session.user = {
        id: user.id,
        name: user.name,
        phone: user.phone
      };
      res.redirect('/dashboard');
    } else {
      res.render('index', { error: '❌ رقم الهاتف أو كلمة المرور غير صحيحة' });
    }
  });
});

// 3. لوحة التحكم
app.get('/dashboard', isAuthenticated, (req, res) => {
  db.get('SELECT * FROM users WHERE id = ?', [req.session.user.id], (err, user) => {
    if (err || !user) return res.redirect('/logout');
    res.render('dashboard', { user });
  });
});

// 4. صفحة التسجيل
app.get('/register', (req, res) => {
  res.render('register');
});

// 5. API التسجيل الجديد
app.post('/api/register', async (req, res) => {
  const { name, phone, password, device_id } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    db.run(
      'INSERT INTO users (name, phone, password, device_id) VALUES (?, ?, ?, ?)',
      [name, phone, hashedPassword, device_id],
      function(err) {
        if (err) return res.json({ error: '❌ رقم الهاتف مسجل مسبقاً' });
        res.json({ success: true, userId: this.lastID });
      }
    );
  } catch (e) {
    res.json({ error: '❌ فشل في عملية التسجيل' });
  }
});

// 6. صفحة شحن المحفظة
app.get('/charge', isAuthenticated, (req, res) => {
  res.render('charge', { user: req.session.user });
});

// 7. API طلب شحن
app.post('/api/charge', isAuthenticated, (req, res) => {
  const { amount, transaction_id, method } = req.body;
  db.run(
    'INSERT INTO wallet_charges (phone, amount, transaction_id, method) VALUES (?, ?, ?, ?)',
    [req.session.user.phone, amount, transaction_id, method],
    (err) => {
      if (err) return res.json({ error: '❌ حدث خطأ في إرسال الطلب' });
      res.json({ success: true });
    }
  );
});

// 8. صفحة الشراء
app.get('/buy', isAuthenticated, (req, res) => {
  db.get('SELECT * FROM users WHERE id = ?', [req.session.user.id], (err, user) => {
    res.render('buy', { user });
  });
});

// 9. API معالجة الشراء
app.post('/api/buy', isAuthenticated, (req, res) => {
  const { card_name, price } = req.body;
  const userId = req.session.user.id;

  db.get('SELECT wallet_balance, phone FROM users WHERE id = ?', [userId], (err, user) => {
    if (err || !user) return res.json({ error: '❌ مستخدم غير موجود' });
    
    if (user.wallet_balance < price) {
      return res.json({ error: '❌ عذراً، رصيدك غير كافٍ' });
    }

    const voucherCode = uuidv4().substring(0, 8).toUpperCase();
    const newBalance = user.wallet_balance - price;

    db.run('UPDATE users SET wallet_balance = ? WHERE id = ?', [newBalance, userId], (err) => {
      if (err) return res.json({ error: '❌ خطأ في تحديث الرصيد' });
      
      db.run(
        'INSERT INTO gift_requests (phone, cost, request_type, voucher_code) VALUES (?, ?, ?, ?)',
        [user.phone, price, card_name, voucherCode],
        (err) => {
          res.json({ success: true, voucherCode, cardType: price });
        }
      );
    });
  });
});

// 10. صفحة عرض الكرت
app.get('/display_card', isAuthenticated, (req, res) => {
  const { code, amount } = req.query;
  res.render('display_card', { code, amount });
});

// 11. صفحة سجل الحركات
app.get('/history', isAuthenticated, (req, res) => {
  const phone = req.session.user.phone;
  const query = `
    SELECT 'شحن' as type, amount, status, created_at, transaction_id as ref FROM wallet_charges WHERE phone = ?
    UNION ALL
    SELECT 'شراء' as type, cost as amount, status, created_at, request_type as ref FROM gift_requests WHERE phone = ?
    ORDER BY created_at DESC
  `;
  db.all(query, [phone, phone], (err, rows) => {
    res.render('history', { transactions: rows || [] });
  });
});

// 12. API معلومات الجلسة (لأغراض JS في المتصفح)
app.get('/api/session', (req, res) => {
  res.json({ 
    phone: req.session.user ? req.session.user.phone : '',
    userId: req.session.user ? req.session.user.id : ''
  });
});

// 13. تسجيل الخروج
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// ========== WebSockets (الإشعارات الفورية) ==========
io.on('connection', (socket) => {
  console.log('مستخدم متصل:', socket.id);
  socket.on('register-user', (userId) => {
    socket.join(`user_${userId}`);
  });
});

// ========== تشغيل الخادم ==========
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`============================================`);
  console.log(`🚀 خادم محفظة المفيد نت يعمل الآن`);
  console.log(`🔗 الرابط المحلي: http://localhost:${PORT}`);
  console.log(`📂 مسار قاعدة البيانات: ${dbPath}`);
  console.log(`============================================`);
});
