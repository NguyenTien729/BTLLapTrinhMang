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
