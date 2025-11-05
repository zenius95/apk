// Load bien moi truong .env vao process.env
require('dotenv').config();

const express = require('express');
const path = require('path');
const ejs = require('ejs');
const ejsLayouts = require('express-ejs-layouts'); 
const http = require('http'); // +++ GOI HTTP SERVER
const { Server } = require("socket.io"); // +++ GOI SOCKET.IO

const sequelize = require('./config/database'); // Ket noi DB
const App = require('./models/app'); // Import Model de sync

// Import "ban do" (routes)
const adminRoutes = require('./routes/adminRoutes');
const apiRoutes = require('./routes/apiRoutes');

// --- KHOI TAO APP EXPRESS ---
const app = express();
const PORT = process.env.PORT || 3000;

// +++ TAO HTTP SERVER VA GAN SOCKET.IO VAO +++
const httpServer = http.createServer(app);
const io = new Server(httpServer);

// +++ TRUYEN 'io' VAO MOI REQUEST DE CONTROLLER CO THE GOI +++
// Day la cach don gian de truyen 'io' vao controller
app.use((req, res, next) => {
  req.io = io;
  next();
});

// --- CAU HINH EJS (View Engine) ---
app.use(ejsLayouts);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layouts/main');

// --- CAU HINH MIDDLEWARE ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// --- CAU HINH ROUTES ("Ban do") ---
app.use('/api', apiRoutes);
app.use('/', adminRoutes);

// +++ THEM LANG NGHE SOCKET CONNECTION ---
io.on('connection', (socket) => {
  console.log(`[Socket.IO] 🟢 Mot Bro vua ket noi: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`[Socket.IO] 🔴 Mot Bro vua ngat ket noi: ${socket.id}`);
  });
});

// --- KHOI DONG SERVER ---
async function startServer() {
  try {
    // 1. Kiem tra ket noi Database
    await sequelize.authenticate();
    console.log('✅✅✅ KET NOI DATABASE THANH CONG! ✅✅✅');

    // 2. Dong bo Model voi Database
    await sequelize.sync({ alter: true });
    console.log('🔄 Da dong bo model Apps voi database.');

    // 3. Khoi dong HTTP SERVER (thay vi app.listen)
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server cua Bro dang chay "phe phe" tai: http://localhost:${PORT}`);
      console.log(`(Nho dung user/pass trong .env de dang nhap nhe)`);
    });
  } catch (error) {
    console.error('❌❌❌ OOPS! Khong the khoi dong server:', error);
    process.exit(1); 
  }
}

// Chien!
startServer();