import {io} from 'socket.io-client';
export const createSocket = token => io({auth:{token},autoConnect:false,reconnection:true});
export function emitAck(socket,event,payload) {
  return new Promise((resolve,reject)=>{
    if (!socket?.connected) return reject(new Error('Mất kết nối. Tin nhắn sẽ được gửi lại khi có mạng.'));
    socket.timeout(8000).emit(event,payload,(error,response)=>{
      if (error) reject(new Error('Chưa nhận được xác nhận từ máy chủ.'));
      else if (!response?.success) reject(Object.assign(new Error(response?.message || 'Thao tác thất bại.'), {status:response?.statusCode}));
      else resolve(response.data);
    });
  });
}
