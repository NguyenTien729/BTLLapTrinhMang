<<<<<<< HEAD
require('dotenv').config();
const http=require('http');
const mongoose=require('mongoose');
const app=require('./src/app');
const connectDB=require('./src/config/db');
const initSocketIO=require('./src/socket');
async function startServer(){
  if(!process.env.JWT_SECRET||Buffer.byteLength(process.env.JWT_SECRET)<32)throw new Error('JWT_SECRET phải có ít nhất 32 byte.');
  await connectDB();
  await Promise.all(['User','Conversation','Message'].map(name=>require('./src/models/'+name).init()));
  await require('./src/models/User').updateMany({isOnline:true},{$set:{isOnline:false}});
  const server=http.createServer(app),io=initSocketIO(server);app.set('io',io);
  const port=Number(process.env.PORT)||5000;
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,resolve);});
  console.log('PTITChat API và Socket.IO: http://localhost:'+port);
  let closing=false;
  const shutdown=async()=>{
    if(closing)return;closing=true;
    const timer=setTimeout(()=>process.exit(1),10000);timer.unref();
    await new Promise(resolve=>io.close(resolve));await mongoose.disconnect();clearTimeout(timer);
  };
  process.once('SIGINT',shutdown);process.once('SIGTERM',shutdown);
  return {server,io};
}
if(require.main===module)startServer().catch(error=>{console.error(error.message);process.exit(1);});
module.exports={startServer};
=======
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const http = require('http');
const app = require('./src/app');
const connectDB = require('./src/config/db');
const initSocketIO = require('./src/socket');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // 1. Kết nối Database
    await connectDB();

    // 2. Tạo HTTP server
    const server = http.createServer(app);

    // 3. Khởi tạo Socket.IO thời gian thực
    const io = initSocketIO(server);
    app.set('io', io);

    // 4. Bắt đầu lắng nghe kết nối
    server.listen(PORT, () => {
      console.log(`===============================================`);
      console.log(`🚀 PTITChat Server đang chạy tại cổng ${PORT}`);
      console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
      console.log(`⚡ Socket.IO : Sẵn sàng đón kết nối`);
      console.log(`🌐 Môi trường: ${process.env.NODE_ENV || 'development'}`);
      console.log(`===============================================`);
    });

    // Graceful shutdown
    const gracefulShutdown = () => {
      console.log('\nĐang dừng server an toàn...');
      server.close(() => {
        console.log('Server đã dừng.');
        process.exit(0);
      });
    };

    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);
  } catch (error) {
    console.error('Lỗi khởi động server:', error.message);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = { startServer };
>>>>>>> 5e92e1bc351b7c2b8b675b3eb00ae45c91e81034
