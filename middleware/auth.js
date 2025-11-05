require('dotenv').config();
const basicAuth = require('express-basic-auth');

// Kiem tra xem Bro da set user/pass trong .env chua
if (!process.env.ADMIN_USER || !process.env.ADMIN_PASS) {
  console.warn(
    '⚠️ Canh bao: ADMIN_USER hoac ADMIN_PASS chua duoc set trong file .env. De tam user/pass la "admin"/"password"'
  );
}

// Lay user/pass tu .env, neu khong co thi dung tam gia tri mac dinh
const adminUser = process.env.ADMIN_USER || 'admin';
const adminPass = process.env.ADMIN_PASS || 'password';

// Tao mot object user don gian
const users = {};
users[adminUser] = adminPass;

// Khoi tao middleware
const adminAuth = basicAuth({
  users: users,
  challenge: true, // Hien thi hop thoai login neu truy cap trai phep
  realm: 'ImASecureArea', // Ten hop thoai login, Bro de gi cung duoc
  unauthorizedResponse: (req) => {
    return req.auth
      ? 'Tai khoan hoac mat khau khong dung. The thoi Bro.'
      : 'Vui long cung cap tai khoan de vao khu vuc "an ninh" nay.';
  }
});

module.exports = adminAuth;