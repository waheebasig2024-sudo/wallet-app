// ============================================
// محفظة المفيد نت - الخادم الرئيسي
// مع دعم الإشعارات الفورية (WebSockets)
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

// ========== الإعدادات ==========
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(session({
  secret: process.env.SESSION_SECRET || 'wallet_secret_2026',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 } // 7 أيام
}));

// ========== قاعدة البيانات ==========
const dbPath = path.join(__dirname, '../database/wallet.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ خطأ في قاعدة البيانات:', err.message);
  } else {
    console.log('✅ قاعدة البيانات متصلة');
    إنشاءالجداول();
  }
});

function إنشاءالجداول() {
  db.serialize(() => {
    // جدول المستخدمين
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT UNIQUE,
        name TEXT,
        password TEXT,
        wallet_balance REAL DEFAULT 0,
        device_id TEXT,
        role TEXT DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // جدول الكروت (المخزون)
    db.run(`
      CREATE TABLE IF NOT EXISTS card_stock (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        card_type TEXT,
        card_code TEXT,
        status TEXT DEFAULT 'available',
        sold_to TEXT,
        sold_at DATETIME
      )
    `);

    // جدول طلبات الشراء
    db.run(`
      CREATE TABLE IF NOT EXISTS gift_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT,
        name TEXT,
        request_type TEXT,
        cost REAL,
        status TEXT DEFAULT 'pending',
        gift_card TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // جدول طلبات الشحن
    db.run(`
      CREATE TABLE IF NOT EXISTS wallet_charges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT,
        amount REAL,
        transaction_id TEXT,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ جميع الجداول جاهزة');
    
    // إضافة بعض الكروت التجريبية إذا كانت فارغة
    db.get('SELECT COUNT(*) as count FROM card_stock', [], (err, row) => {
      if (err) return;
      if (row.count === 0) {
        const sampleCards = [
          { type: '200', code: 'MF' + Math.floor(Math.random() * 1000000) },
          { type: '200', code: 'MF' + Math.floor(Math.random() * 1000000) },
          { type: '300', code: 'MF' + Math.floor(Math.random() * 1000000) },
          { type: '300', code: 'MF' + Math.floor(Math.random() * 1000000) },
          { type: '500', code: 'MF' + Math.floor(Math.random() * 1000000) },
          { type: '500', code: 'MF' + Math.floor(Math.random() * 1000000) },
          { type: '1000', code: 'MF' + Math.floor(Math.random() * 1000000) },
          { type: '1000', code: 'MF' + Math.floor(Math.random() * 1000000) },
          { type: '3000', code: 'MF' + Math.floor(Math.random() * 1000000) },
          { type: '3000', code: 'MF' + Math.floor(Math.random() * 1000000) }
        ];
        const stmt = db.prepare('INSERT INTO card_stock (card_type, card_code) VALUES (?, ?)');
        sampleCards.forEach(card => {
          stmt.run([card.type, card.code]);
        });
        stmt.finalize();
        console.log('✅ تم إضافة كروت تجريبية');
      }
    });
  });
}

// ========== دوال مساعدة ==========
function isLoggedIn(req) {
  return req.session.userId ? true : false;
}

function validatePhone(phone) {
  // يبدأ بـ 7 ويتكون من 9 أرقام
  const phoneRegex = /^7[0-9]{8}$/;
  return phoneRegex.test(phone);
}

// ========== WebSockets للإشعارات ==========
const connectedUsers = {};

io.on('connection', (socket) => {
  console.log('🟢 مستخدم متصل:', socket.id);

  socket.on('register-user', (userId) => {
    connectedUsers[userId] = socket.id;
    console.log(`✅ المستخدم ${userId} مسجل للإشعارات`);
  });

  socket.on('disconnect', () => {
    for (const [userId, socketId] of Object.entries(connectedUsers)) {
      if (socketId === socket.id) {
        delete connectedUsers[userId];
        break;
      }
    }
    console.log('🔴 مستخدم انقطع');
  });
});

// دالة إرسال إشعار
function sendNotification(userId, message, data = {}) {
  const socketId = connectedUsers[userId];
  if (socketId) {
    io.to(socketId).emit('notification', {
      message,
      data,
      timestamp: new Date()
    });
  }
}

// ========== الصفحات ==========
app.get('/', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.render('index', { error: null });
});

app.get('/register', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.render('register', { error: null });
});

app.get('/dashboard', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/');
  }
  
  db.get('SELECT * FROM users WHERE id = ?', [req.session.userId], (err, user) => {
    if (err || !user) {
      return res.redirect('/');
    }
    res.render('dashboard', { user });
  });
});

app.get('/buy', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/');
  }
  
  db.get('SELECT wallet_balance FROM users WHERE id = ?', [req.session.userId], (err, user) => {
    const balance = user ? user.wallet_balance : 0;
    res.render('buy', { balance, error: null, success: null, purchaseData: null });
  });
});

app.get('/charge', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/');
  }
  res.render('charge', { error: null, success: null });
});

app.get('/history', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/');
  }
  
  const phone = req.session.phone;
  
  db.all('SELECT "شحن" as type, amount, status, created_at, transaction_id as ref FROM wallet_charges WHERE phone = ?', [phone], (err, charges) => {
    db.all('SELECT "شراء" as type, cost as amount, status, created_at, request_type as ref FROM gift_requests WHERE phone = ?', [phone], (err, gifts) => {
      let transactions = [...(charges || []), ...(gifts || [])];
      transactions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      res.render('history', { transactions });
    });
  });
});

app.get('/display_card', (req, res) => {
  const code = req.query.code || '';
  const amount = req.query.amount || '';
  res.render('display_card', { code, amount });
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// ========== API Routes ==========

// مسار الحصول على بيانات الجلسة
app.get('/api/session', (req, res) => {
  if (req.session.userId) {
    res.json({ 
      userId: req.session.userId, 
      phone: req.session.phone,
      name: req.session.userName 
    });
  } else {
    res.json({ error: 'غير مسجل' });
  }
});

// تسجيل مستخدم جديد
app.post('/api/register', async (req, res) => {
  const { name, phone, password, confirm_password, device_id } = req.body;
  
  if (!name || !phone || !password) {
    return res.json({ error: 'جميع الحقول مطلوبة' });
  }
  
  if (!validatePhone(phone)) {
    return res.json({ error: 'رقم الهاتف يجب أن يبدأ بـ 7 ويتكون من 9 أرقام' });
  }
  
  if (password !== confirm_password) {
    return res.json({ error: 'كلمة المرور غير متطابقة' });
  }
  
  if (password.length < 4) {
    return res.json({ error: 'كلمة المرور يجب أن تكون 4 أحرف على الأقل' });
  }
  
  db.get('SELECT phone FROM users WHERE phone = ?', [phone], async (err, existing) => {
    if (existing) {
      return res.json({ error: 'رقم الهاتف مستخدم بالفعل' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    db.run(
      'INSERT INTO users (phone, name, password, device_id) VALUES (?, ?, ?, ?)',
      [phone, name, hashedPassword, device_id || null],
      function(err) {
        if (err) {
          return res.json({ error: 'حدث خطأ في التسجيل' });
        }
        res.json({ success: true });
      }
    );
  });
});

// تسجيل الدخول
app.post('/api/login', async (req, res) => {
  const { phone, password, device_id } = req.body;
  
  if (!phone || !password) {
    return res.json({ error: 'جميع الحقول مطلوبة' });
  }
  
  db.get('SELECT * FROM users WHERE phone = ?', [phone], async (err, user) => {
    if (err || !user) {
      return res.json({ error: 'رقم الهاتف أو كلمة المرور غير صحيحة' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.json({ error: 'رقم الهاتف أو كلمة المرور غير صحيحة' });
    }
    
    // التحقق من الجهاز (نفس الهاتف) - إذا كان هناك device_id مسجل
    if (user.device_id && user.device_id !== device_id) {
      return res.json({ error: 'لا يمكن الدخول من جهاز مختلف، هذا الحساب مرتبط بجهاز آخر' });
    }
    
    // تحديث device_id إذا كان فارغاً
    if (!user.device_id && device_id) {
      db.run('UPDATE users SET device_id = ? WHERE id = ?', [device_id, user.id]);
    }
    
    req.session.userId = user.id;
    req.session.phone = user.phone;
    req.session.userName = user.name;
    
    res.json({ success: true });
  });
});

// شراء كرت
app.post('/api/buy', (req, res) => {
  const { userId, card_name, price, card_type } = req.body;
  
  if (!userId || !card_name || !price || !card_type) {
    return res.json({ error: 'بيانات غير مكتملة' });
  }
  
  db.get('SELECT wallet_balance, phone, name FROM users WHERE id = ?', [userId], (err, user) => {
    if (err || !user) {
      return res.json({ error: 'المستخدم غير موجود' });
    }
    
    if (user.wallet_balance < price) {
      return res.json({ error: 'الرصيد غير كافٍ' });
    }
    
    db.get('SELECT * FROM card_stock WHERE card_type = ? AND status = "available" LIMIT 1', [card_type], (err, card) => {
      if (err || !card) {
        return res.json({ error: 'لا يوجد كروت متاحة حالياً' });
      }
      
      const voucherCode = card.card_code;
      
      db.serialize(() => {
        db.run('UPDATE card_stock SET status = "sold", sold_to = ?, sold_at = CURRENT_TIMESTAMP WHERE id = ?', [user.phone, card.id]);
        db.run('UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?', [price, userId]);
        db.run(
          'INSERT INTO gift_requests (phone, name, request_type, cost, status, gift_card) VALUES (?, ?, ?, ?, "completed", ?)',
          [user.phone, user.name, card_name, price, voucherCode]
        );
        
        // إرسال إشعار فوري
        sendNotification(userId, `✅ تم شراء ${card_name} بنجاح! الكود: ${voucherCode}`);
        
        res.json({ success: true, voucherCode, cardType: card_type, newBalance: user.wallet_balance - price });
      });
    });
  });
});

// طلب شحن المحفظة
app.post('/api/charge', (req, res) => {
  const { phone, amount, transaction_id, method } = req.body;
  
  if (!phone || !amount || !transaction_id) {
    return res.json({ error: 'جميع الحقول مطلوبة' });
  }
  
  if (amount < 100) {
    return res.json({ error: 'الحد الأدنى للشحن 100 ريال' });
  }
  
  db.run(
    'INSERT INTO wallet_charges (phone, amount, transaction_id, status) VALUES (?, ?, ?, "pending")',
    [phone, amount, transaction_id],
    function(err) {
      if (err) {
        return res.json({ error: 'حدث خطأ في إرسال الطلب' });
      }
      res.json({ success: true });
    }
  );
});

// جلب رصيد المستخدم
app.get('/api/balance/:userId', (req, res) => {
  const { userId } = req.params;
  
  db.get('SELECT wallet_balance FROM users WHERE id = ?', [userId], (err, row) => {
    if (err || !row) {
      return res.json({ balance: 0 });
    }
    res.json({ balance: row.wallet_balance });
  });
});

// جلب سجل المعاملات API
app.get('/api/transactions/:userId', (req, res) => {
  const { userId } = req.params;
  
  db.get('SELECT phone FROM users WHERE id = ?', [userId], (err, user) => {
    if (err || !user) {
      return res.json({ transactions: [] });
    }
    
    const phone = user.phone;
    
    db.all('SELECT "شحن" as type, amount, status, created_at, transaction_id as ref FROM wallet_charges WHERE phone = ?', [phone], (err, charges) => {
      db.all('SELECT "شراء" as type, cost as amount, status, created_at, request_type as ref FROM gift_requests WHERE phone = ?', [phone], (err, gifts) => {
        let transactions = [...(charges || []), ...(gifts || [])];
        transactions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        res.json({ transactions });
      });
    });
  });
});

// ========== تشغيل الخادم ==========
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 الخادم يعمل على http://localhost:${PORT}`);
  console.log(`📱 محفظة المفيد نت جاهزة للإشعارات الفورية`);
});