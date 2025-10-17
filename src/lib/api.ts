import axios from 'axios';

const baseURL = `${ORIGIN}:${BACKEND_PORT}/api`;

export const api = axios.create({
  baseURL,
});