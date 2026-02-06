import axios from 'axios';

const API = axios.create({
  baseURL: '/wt-api/v2',
});

export const getPages = (params) => API.get('/pages/', { params });
export const getPage = (id) => API.get('/pages/' + id + '/');
export const getPageByType = (type) => API.get('/pages/', { params: { type, fields: '*' } });
export const getChildren = (parentId) => API.get('/pages/', { params: { child_of: parentId, fields: '*' } });
export const getImages = (params) => API.get('/images/', { params });

export default API;
