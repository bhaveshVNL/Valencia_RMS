import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000/api",
});

api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem("token");

    if (token && token !== "undefined" && token !== "null") {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      "";

    const lowerMessage = String(message).toLowerCase();

    const isRealAuthError =
      error.response?.status === 401 ||
      lowerMessage.includes("authorization token missing") ||
      lowerMessage.includes("invalid token") ||
      lowerMessage.includes("jwt expired") ||
      lowerMessage.includes("token expired") ||
      lowerMessage.includes("malformed token");

    if (isRealAuthError) {
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("user");
      localStorage.removeItem("token");
      localStorage.removeItem("user");

      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

export default api;