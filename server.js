require('dotenv').config();

const express = require('express');
const path = require('path');
const ejs = require('ejs');
const ejsLayouts = require('express-ejs-layouts'); 
const http = require('http'); 
const { Server } = require("socket.io"); 

const sequelize = require('./config/database'); 
const App = require('./models/app'); 
const WpSite = require('./models/wpSite'); 
const WpPostLog = require('./models/wpPostLog'); // +++ MOI: Import de sync DB +++

const adminRoutes = require('./routes/adminRoutes');
const apiRoutes = require('./routes/apiRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

const httpServer = http.createServer(app);
const io = new Server(httpServer);

app.use((req, res, next) => {
  req.io = io;
  next();
});

app.use(ejsLayouts);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layouts/main');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', apiRoutes);
app.use('/', adminRoutes);

io.on('connection', (socket) => {
  console.log(`[Socket.IO] 🟢 Mot Bro vua ket noi: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`[Socket.IO] 🔴 Mot Bro vua ngat ket noi: ${socket.id}`);
  });
});

async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('✅✅✅ KET NOI DATABASE THANH CONG! ✅✅✅');

    // Sync DB (Tao bang moi wp_post_logs)
    await sequelize.sync({ alter: true });
    console.log('🔄 Da dong bo cac models voi database.');

    httpServer.listen(PORT, () => {
      console.log(`🚀 Server cua Bro dang chay "phe phe" tai: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌❌❌ OOPS! Khong the khoi dong server:', error);
    process.exit(1); 
  }
}

startServer();