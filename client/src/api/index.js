import axios from "axios";
import { clearCookie } from "./auth";

const axiosSecure = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

axiosSecure.interceptors.response.use(
  (response) => response,
  async (error) => {
    console.log("error tracked in the interceptor", error.response);
    if (
      (error.response && error.response.status === 404) ||
      error.response.status === 401
    ) {
      await clearCookie();
      window.location.replace("/login");
    }
    return Promise.reject(error);
  }
);

export default axiosSecure;
