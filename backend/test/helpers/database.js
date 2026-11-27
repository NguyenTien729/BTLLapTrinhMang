const mongoose=require('mongoose');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {MongoMemoryServer}=require('mongodb-memory-server');
let memory;
async function startDatabase(){
  const dbName='ptitchat_test_'+randomUUID().replaceAll('-','');
  let uri=process.env.MONGODB_URI_TEST;
  if(!uri){
    memory=await MongoMemoryServer.create({binary:{downloadDir:path.resolve(__dirname,'../../../.mongodb-binaries')}});
    uri=memory.getUri();
  }
  await mongoose.connect(uri,{dbName,serverSelectionTimeoutMS:5000});
}
async function stopDatabase(){
  if(mongoose.connection.readyState===1&&mongoose.connection.name.startsWith('ptitchat_test_'))await mongoose.connection.dropDatabase();
  await mongoose.disconnect();if(memory)await memory.stop();
}
module.exports={startDatabase,stopDatabase};
