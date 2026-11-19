import axios from 'axios';

const API = axios.create({
  baseURL: '/wt-api/v2',
});

export const getPages = (params) => API.get('/pages/', { params });
export const getPage = (id) => API.get('/pages/' + id + '/');
export const getPageByType = (type) => API.get('/pages/', { params: { type, fields: '*' } });
// Без type API отдаёт у дочерних страниц только заголовки: поля конкретной модели
// (фото, даты, описания) приходят лишь при указании её типа.
export const getChildren = (parentId, type, order) => API.get('/pages/', {
  params: { child_of: parentId, fields: '*', ...(type && { type }), ...(order && { order }) },
});
export const getImages = (params) => API.get('/images/', { params });

export default API;
