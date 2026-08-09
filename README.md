# 🛒 AnggiJajanV2 — Game Top-Up & PPOB

AnggiJajanV2 is a full-stack digital product transaction platform for **game top-ups and PPOB products**.

The project is built as a monorepo with a **Next.js frontend** and **Golang REST API**, backed by **PostgreSQL** and integrated with digital product providers and payment services.

🌐 **Live Demo:** https://anggijajan.web.app

---

## ✨ Overview

AnggiJajanV2 provides a storefront and administration system for managing digital products, game top-ups, payment methods, transactions, providers, and product pricing.

The current payment architecture is centered around **Midtrans** for the customer checkout flow, with transaction pricing protected through server-side quote validation and payment hardening.

The project is currently in an active development / pre-production stage.

---

## 🚀 Key Features

### 🛍️ Storefront

- Game top-up storefront
- Game/product catalog
- Game detail and checkout flow
- Responsive mobile and desktop UI
- Cyberpunk / neon glassmorphism design
- Payment method selection
- Server-generated payment quote
- Checkout total validation
- Order status checking

### 💳 Payment

- **Midtrans** payment gateway integration
- Multiple Midtrans payment channels
- QRIS
- E-Wallet payment methods
- Virtual Account payment methods
- Credit Card
- PayLater / additional payment channels where supported
- Dynamic payment fee handling
- Customer / merchant fee bearer configuration
- Payment method limits
- Production fee safeguards
- Quote mismatch protection
- Server-side final amount validation

> Payment availability and limits depend on the configuration and capabilities of the active Midtrans environment.

### 🎮 Digital Product Providers

#### Digiflazz

- Product synchronization
- Product availability management
- Provider cost management
- Selling price / markup management
- Automated transaction processing
- Provider status handling
- Sync protection and lifecycle handling

#### ApiGames

- Product / price list synchronization
- Provider lifecycle management

> ApiGames fulfillment is still subject to the current implementation status and should not be considered equivalent to the Digiflazz transaction flow.

### 🧑‍💼 Admin Panel

- Dashboard
- Product management
- Product grouping
- Product synchronization
- Transaction management
- Provider management
- Banner management
- Payment settings
- Application settings
- Manual administrative operations
- Product pricing / markup management

### 🔐 Security & Reliability

- JWT-based admin authentication
- Protected admin endpoints
- Server-side payment quote validation
- Payment amount verification
- Production fee safeguards
- Payment logo URL validation
- Database transaction safety
- Provider lifecycle protection
- Backend automated tests for critical payment and database logic

---

## 🏗️ Architecture

```text
┌─────────────────────────────┐
│        Next.js Frontend     │
│  Storefront + Admin Panel   │
└──────────────┬──────────────┘
               │ REST API
               ▼
┌─────────────────────────────┐
│        Golang Backend       │
│ Controllers / Services      │
│ Payment / Provider Logic    │
│ Authentication              │
└──────────────┬──────────────┘
               │
       ┌───────┴────────┐
       ▼                ▼
┌─────────────┐   ┌─────────────┐
│ PostgreSQL  │   │ External APIs│
│ Products    │   │ Midtrans    │
│ Transactions│   │ Digiflazz   │
│ Settings    │   │ ApiGames     │
│ Users       │   │             │
└─────────────┘   └─────────────┘
```

---

## 🛠️ Tech Stack

### Frontend

- **Next.js**
- **React**
- **TypeScript**
- **Tailwind CSS**
- Framer Motion
- Next.js App Router

### Backend

- **Golang**
- **Fiber**
- **GORM**
- REST API

### Database

- **PostgreSQL**

### Payment

- **Midtrans**

### Digital Product Providers

- **Digiflazz**
- **ApiGames**

### Development

- Git / GitHub
- Docker
- ESLint
- TypeScript
- Go testing

---

## 📂 Project Structure

```text
AnggiJajanV2/
│
├── backend/
│   ├── controllers/
│   ├── database/
│   ├── middleware/
│   ├── models/
│   ├── payments/
│   └── main.go
│
├── frontend/
│   ├── public/
│   └── src/
│       ├── app/
│       └── components/
│
├── .gitignore
├── README.md
└── ...
```

---

## ⚙️ Environment Variables

Sensitive configuration files are intentionally excluded from Git.

The project requires environment variables for things such as:

- PostgreSQL connection
- JWT secret
- Midtrans credentials
- Digiflazz credentials
- ApiGames credentials
- Backend API URL
- Frontend configuration

Create the appropriate `.env` files locally before running the application.

> Never commit production credentials, API keys, merchant keys, server keys, or database credentials to the repository.

---

## 💻 Running Locally

### 1. Backend

```bash
cd backend
go run main.go
```

Make sure the backend `.env` is configured before starting the server.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend development server will run on the configured Next.js development port.

---

## 🧪 Testing

Backend tests:

```bash
cd backend
go test ./...
```

Frontend validation:

```bash
cd frontend
npm run lint
npx tsc --noEmit
```

---

## 💳 Payment Architecture

The current customer checkout architecture uses **Midtrans**.

Older payment integrations such as **Tripay** and **Duitku** existed during earlier development stages but are no longer the primary customer checkout solution.

The migration to Midtrans was driven by payment pricing, fee structure, minimum transaction requirements, and the need for a more suitable production payment configuration.

The current implementation focuses on:

```text
Customer
   │
   ▼
Game / Product Selection
   │
   ▼
Payment Quote
   │
   ▼
Midtrans Payment Method
   │
   ▼
Final Amount Validation
   │
   ▼
Midtrans Checkout
   │
   ▼
Payment Callback / Status
   │
   ▼
Provider Fulfillment
   │
   ▼
Transaction Completed
```

---

## 📌 Current Development Status

AnggiJajanV2 is currently in **active development / pre-production**.

Core systems already implemented include:

- Admin dashboard
- Product management
- Product grouping
- Provider synchronization
- Digiflazz integration
- Midtrans checkout flow
- Payment quote system
- Payment profit protection
- Payment method configuration
- Transaction management
- Database integrity safeguards
- Backend automated tests

Some areas are still being refined before a full production launch, particularly payment UX, production configuration, provider coverage, and deployment hardening.

---

## 🌐 Demo

**Live Demo:** https://anggijajan.web.app

The demo environment is intended to showcase the current storefront and UI/UX implementation.

---

## 👨‍💻 Developer

**Derry Andhika**

GitHub: https://github.com/lezuter

---

## 📄 License

This project is currently maintained as a personal development project.
