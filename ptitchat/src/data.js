export const people = [
  { id: 'minhanh', name: 'Nguyễn Minh Anh', username: 'minhanh', color: '#b91f3b', online: true, bio: 'Cùng nhau tạo nên những điều tuyệt vời ✨', studentId: 'B21DCCN001', email: 'minhanh@ptit.edu.vn' },
  { id: 'hoangnam', name: 'Trần Hoàng Nam', username: 'hoangnam', color: '#66876d', online: true, bio: 'Keep learning, keep growing.', studentId: 'B21DCCN042' },
  { id: 'thao', name: 'Lê Phương Thảo', username: 'phuongthao', color: '#ba8c6d', online: true, studentId: 'B21DCCN085' },
  { id: 'duc', name: 'Phạm Minh Đức', username: 'minhduc', color: '#7587b1', online: false, studentId: 'B21DCCN023' },
  { id: 'linh', name: 'Đỗ Khánh Linh', username: 'khanhlinh', color: '#9c7faa', online: true, studentId: 'B21DCCN065' },
  { id: 'huy', name: 'Nguyễn Quang Huy', username: 'quanghuy', color: '#c18d52', online: false, studentId: 'B21DCCN054' },
];
const at = (hour, minute) => { const d = new Date(); d.setHours(hour, minute, 0, 0); return d.toISOString(); };
export function initialState() {
 return { people, conversations: [
   { id: 'project', name: 'Đồ án tốt nghiệp', emoji: '🎓', type: 'group', members: ['minhanh','hoangnam','thao','duc','linh'], pinned: true, unread: 3, color: '#b52740', description: 'Một chiếc nhóm nhỏ, những ý tưởng lớn. Cùng nhau hoàn thành đồ án thật tốt nhé! 🚀', createdAt: at(8,0), messages: [
     {id:'m1', sender:'hoangnam', text:'Chào buổi sáng mọi người! ☀️\nMình đã cập nhật bản thiết kế mới trên Figma rồi nhé.', time:at(9,30)},
     {id:'m2', sender:'thao', text:'Đẹp quá Nam ơi! Mình thích màu đỏ này, rất đúng tinh thần PTIT ❤️', time:at(9,32)},
     {id:'m3', sender:'minhanh', text:'Mình cũng vừa hoàn thành phần tài liệu API.\nMọi người xem rồi góp ý giúp mình nhé 🙌', time:at(9,34)},
     {id:'m4', sender:'minhanh', text:'', time:at(9,34), file:{ name:'Tài liệu API – PTITChat.pdf', size:2457600, type:'application/pdf', sample:true }},
     {id:'m5', sender:'hoangnam', text:'Chiều nay mình họp nhóm ở thư viện nhé?\nTranh thủ chụp được góc này của trường mình 📸', time:at(9,36), image:'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=900&auto=format&fit=crop&q=85'},
     {id:'m6', sender:'linh', text:'Okee, 14h mình có mặt nhé! ✨', time:at(9,38)},
   ]},
   {id:'nam', type:'direct', members:['minhanh','hoangnam'], unread:2, messages:[{id:'n1',sender:'hoangnam',text:'Minh Anh ơi, cậu xem giúp mình phần Socket.IO với nhé 👋',time:at(9,40)}]},
   {id:'class', name:'D21CQCN01-B', emoji:'💻', type:'group', color:'#677ba3', members:people.map(p=>p.id), unread:12, messages:[{id:'c1',sender:'duc',text:'Mọi người nhớ nộp bài trước 23h59 hôm nay nha!',time:at(9,15)}]},
   {id:'thao',type:'direct',members:['minhanh','thao'],unread:0,messages:[{id:'t1',sender:'minhanh',text:'Cảm ơn Thảo nha 💕',time:at(8,50)}]},
   {id:'club',name:'CLB Lập trình PTIT',emoji:'⚡',type:'group',color:'#c39a56',members:['minhanh','hoangnam','huy','duc'],unread:0,messages:[{id:'cl1',sender:'huy',text:'[Thông báo] Lịch sinh hoạt tuần này',time:at(8,15)}]},
   {id:'duc',type:'direct',members:['minhanh','duc'],unread:0,messages:[{id:'d1',sender:'duc',text:'Ok cậu, để mình kiểm tra lại nhé.',time:at(7,55)}]},
   {id:'linh',type:'direct',members:['minhanh','linh'],unread:0,messages:[{id:'l1',sender:'linh',text:'Hẹn gặp cậu ở trường nha 🌷',time:at(7,30)}]},
 ] };
}
export const initials = (name='') => name.split(' ').filter(Boolean).slice(-2).map(s=>s[0]).join('').toUpperCase();
export const timeText = time => new Date(time).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'});
export const sizeText = size => (!size || isNaN(size)) ? 'Tệp đính kèm' : size > 1048576 ? `${(size/1048576).toFixed(1)} MB` : `${Math.max(1,Math.round(size/1024))} KB`;
export const normalize = text => (text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase();
