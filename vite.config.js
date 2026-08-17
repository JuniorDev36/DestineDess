import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        about: resolve(__dirname, "about.html"),
        pricing: resolve(__dirname, "pricing.html"),
        lessons: resolve(__dirname, "lessons.html"),
        contact: resolve(__dirname, "contact.html"),
        login: resolve(__dirname, "login.html"),
        register: resolve(__dirname, "register.html"),
        forgotPassword: resolve(__dirname, "forgot-password.html"),
        studentPortal: resolve(__dirname, "student-portal.html"),
        privacy: resolve(__dirname, "privacy.html"),
        terms: resolve(__dirname, "terms.html"),
        admindashboard: resolve(__dirname, "admin-dashboard.html"),
        adminstudent: resolve(__dirname, "admin-student.html"),
      },
    },
  },
});