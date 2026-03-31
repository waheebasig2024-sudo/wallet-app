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
const fs = require('fs');

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
  secret: process.env.SESSION_SECRET || 'wallet_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

// ========== إنشاء مجلد قاعدة البيانات ==========
const dbDir = path.join(__dirname, '../database');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}
const dbPath = path.join(dbDir, 'wallet.db');
console.log('📁 مسار قاعدة البيانات:', dbPath);

// ========== قاعدة البيانات ==========
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ خطأ في قاعدة البيانات:', err.message);
  } else {
    console.log('✅ قاعدة البيانات متصلة بنجاح');
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
    `, (err) => {
      if (err) console.error('خطأ في جدول users:', err.message);
      else console.log('✅ جدول users جاهز');
    });

    // جدول الكروت
    db.run(`
      CREATE TABLE IF NOT EXISTS card_stock (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        card_type TEXT,
        card_code TEXT,
        status TEXT DEFAULT 'available',
        sold_to TEXT,
        sold_at DATETIME
      )
    `, (err) => {
      if (err) console.error('خطأ في جدول card_stock:', err.message);
      else console.log('✅ جدول card_stock جاهز');
    });

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
    `, (err) => {
      if (err) console.error('خطأ في جدول gift_requests:', err.message);
      else console.log('✅ جدول gift_requests جاهز');
    });

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
    `, (err) => {
      if (err) console.error('خطأ في جدول wallet_charges:', err.message);
      else console.log('✅ جدول wallet_charges جاهز');
    });

    // إضافة بعض الكروت التجريبية إذا كانت فارغة
    db.get("SELECT COUNT(*) as count FROM card_stock", [], (err, row) => {
      if (!err && row.count === 0) {
        const sampleCards = [
          { type: '200', code: 'CARD200' + Math.floor(Math.random() * 10000) },
          { type: '300', code: 'CARD300' + Math.floor(Math.random() * 10000) },
          { type: '500', code: 'CARD500' + Math.floor(Math.random() * 10000) },
          { type: '1000', code: 'CARD1000' + Math.floor(Math.random() * 10000) },
          { type: '3000', code: 'CARD3000' + Math.floor(Math.random() * 10000) }
        ];
        sampleCards.forEach(card => {
          db.run("INSERT INTO card_stock (card_type, card_code, status) VALUES (?, ?, 'available')", [card.type, card.code]);
        });
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

function sendNotification(userId, message, data = {}) {
  const socketId = connectedUsers[userId];
  if (socketId) {
    io.to(socketId).emit('notification', { message, data, timestamp: new Date() });
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
    
    if (user.device_id && user.device_id !== device_id) {
      return res.json({ error: 'لا يمكن الدخول من جهاز مختلف' });
    }
    
    if (!user.device_id && device_id) {
      db.run('UPDATE users SET device_id = ? WHERE id = ?', [device_id, user.id]);
    }
    
    req.session.userId = user.id;
    req.session.phone = user.phone;
    req.session.userName = user.name;
    
    res.json({ success: true });
  });
});

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
        
        sendNotification(userId, `✅ تم شراء ${card_name} بنجاح! الكود: ${voucherCode}`);
        
        res.json({ success: true, voucherCode, cardType: card_type, newBalance: user.wallet_balance - price });
      });
    });
  });
});

app.post('/api/charge', (req, res) => {
  const { phone, amount, transaction_id } = req.body;
  
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

// ========== تشغيل الخادم ==========
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 الخادم يعمل على http://localhost:${PORT}`);
});
