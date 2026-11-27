export const initials=(name='')=>name.split(' ').filter(Boolean).slice(-2).map(word=>word[0]).join('').toUpperCase();
export const timeText=time=>new Date(time).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'});
export const sizeText=size=>size>1048576?(size/1048576).toFixed(1)+' MB':Math.max(1,Math.round(size/1024))+' KB';
export const normalize=text=>(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase();
