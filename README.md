# Project Management API

A RESTful and Real-Time API built with **Node.js**, **Express**, **MongoDB**, and **Socket.IO** for managing workspaces, projects, tasks, and comments — following a clean **Repository–Service pattern** for scalability and testability.

---

## 🚀 Features

- User authentication with JWT
- Workspaces and projects management
- Tasks CRUD operations with assigned users
- Comments under tasks
- Project and task statistics
- Real-time collaboration using **Socket.IO**
- Live task creation, updates, and deletions
- Real-time project updates
- User-specific event emission
- Clean architecture (Repository + Service layers)
- Unit and integration testing with Jest

---

## 🧱 Tech Stack

- **Node.js**
- **Express.js**
- **MongoDB + Mongoose**
- **Socket.IO**
- **Jest**

---

## Environment Variables

Create a .env file in the root directory and add the following:

PORT=3000
NODE_ENV=development

DATABASE=mongodb://127.0.0.1:27017/projectify
DATABASE_TEST=mongodb://localhost:27017/projectify_test

JWT_SECRET=<your-jwt-secret>
JWT_EXPIRES_IN=90d
JWT_COOKIE_EXPIRES_IN=90

EMAIL_USERNAME=<your-mailtrap-username>
EMAIL_PASSWORD=<your-mailtrap-password>
EMAIL_HOST=sandbox.smtp.mailtrap.io
EMAIL_PORT=2525

## Running the App

```bash
npm install
npm start
```

## Testing the App

```bash
npm test
```
