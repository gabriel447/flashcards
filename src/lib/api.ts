import axios from 'axios';

const baseURL = `${ORIGIN}:${PORT}/api`;

export const api = axios.create({
  baseURL,
});