# 🛒 AnggiJajanV2 - Top-Up Game & PPOB (Monorepo)

A high-performance RESTful API and sleek Frontend application designed to automate digital product transactions (Game Top-up & PPOB). Upgraded to a Monorepo architecture featuring a modern **Next.js** UI with a Cyberpunk/Neon theme, powered by a lightning-fast **Golang** backend.

![Index](https://github.com/user-attachments/assets/60a26eed-b16a-4cf6-b7de-6c2f3c931a76)

## 🚀 Key Features

* **Automated Transactions:** Seamless integration with **Tripay** (Payment Gateway) and **Digiflazz** (PPOB Provider) via Webhook for instant order processing.
* **Modern UI/UX:** Stunning Cyberpunk/Neon-themed frontend with smooth Glassmorphism effects and fully responsive design.
* **Secure Authentication:** Multi-level security using **Google OAuth 2.0** and **JWT (JSON Web Token)** for robust session management.
* **Monorepo Architecture:** Clean separation of concerns between the React-based frontend and the Golang REST API within a single repository.

## 🛠️ Tech Stack

### 🎨 Frontend (UI/UX)
* **Framework:** Next.js (App Router), React
* **Styling:** Tailwind CSS (Custom Neon & Glassmorphism themes)
* **Language:** TypeScript
* **Typography:** Minecraftia (Gaming Identity), IBM Plex Mono (Technical Data), Inter (Standard Text)

### ⚙️ Backend (API)
* **Runtime/Language:** Golang (Go)
* **Database:** MySQL
* **Integrations:** Tripay API, Digiflazz API
* **Auth:** JWT (JSON Web Token)

## ⚠️ Important Note

This repository contains the Source Code for both Frontend and Backend.
Sensitive configuration files (`.env`) containing API Keys, Database credentials, and Secret Tokens have been excluded for security reasons.

## 📂 Project Structure

```text
├── backend/          # Golang REST API
│   ├── controllers/  # Request logic & handlers
│   ├── database/     # DB connection & seeders
│   ├── middleware/   # Auth & security layers
│   ├── models/       # Database schemas/structs
│   ├── routes/       # API endpoints
│   └── main.go       # Entry point backend
│
├── frontend/         # Next.js Application
│   ├── public/       # Static assets, SVG, Animations
│   └── src/
│       ├── app/      # Next.js App Router (Pages & Layouts)
│       └── components/ # Reusable UI Components (Modals, Tables, etc.)


💻 How to Run Locally
1. Starting the Backend (Golang)
cd backend
# Make sure your .env file is configured correctly
go run main.go

2. Starting the Frontend (Next.js)
cd frontend
npm install
npm run dev
# Open http://localhost:3000 in your browser

Developed by Derry Andhika