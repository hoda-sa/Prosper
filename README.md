# Prosper 💰

A comprehensive personal finance tracker designed to help you take control of your financial health and achieve your financial goals.

## 📋 Table of Contents

* [Features](#features)
* [Demo](#demo)
* [Installation](#installation)
* [Usage](#usage)
* [Technologies Used](#technologies-used)
* [Project Structure](#project-structure)
* [License](#license)
* [Contact](#contact)

## ✨ Features

### Core Functionality

* **Income & Expense Tracking**: Record and categorize all your financial transactions.
* **Budget Management**: Set monthly or yearly budgets and track your spending.
* **Financial Goals**: Create and monitor your savings and financial objectives.
* **Balance Overview**: View your real-time financial standing.

### Analytics & Reporting

* **Spending Analysis**: Get a detailed breakdown of expenses by category and time period.
* **Financial Reports**: Generate monthly and yearly financial reports.
* **Visual Dashboards**: Interactive charts and graphs to visualize your finances.
* **Trend Analysis**: Track your spending patterns and trends over time.

### User Experience

* **Intuitive Interface**: Clean, user-friendly design for smooth navigation.
* **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices.
* **Data Security**: Secure storage and handling of your financial data.
* **Export Functionality**: Export your data to CSV or PDF.

## 🚀 Demo

**[Live demo](https://prosper-frontend.onrender.com/)**

## 🛠️ Installation

### Prerequisites

Make sure you have the following installed:

* [Node.js](https://nodejs.org/) (v14 or higher)
* [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
* [Git](https://git-scm.com/)

### Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/hoda-sa/Prosper.git
   cd Prosper
   ```

2. **Set up the backend**

   ```bash
   cd server
   npm install
   npm run dev
   ```

3. **Set up the frontend**

   ```bash
   cd ../client
   npm install
   npm start
   ```

4. **Set up environment variables**

   In the `server` directory:

   ```bash
   cp .env.example .env
   # Edit the .env file with your configuration
   ```

   **Frontend `.env`**

   ```env
   # API Configuration
   REACT_APP_API_URL=http://localhost:5001/api

   # Auth0 Configuration
   REACT_APP_AUTH0_DOMAIN=your-auth0-domain.auth0.com
   REACT_APP_AUTH0_AUDIENCE=your-auth0-audience
   REACT_APP_AUTH0_CLIENT_ID=your-auth0-client-id
   AUTH0_CLIENT_SECRET=your-auth0-client-secret

   # Optional: Redirect URI
   REACT_APP_AUTH0_REDIRECT_URI=http://localhost:3000
   ```

   **Backend `.env`**

   ```env
   # Server Configuration
   PORT=5001
   NODE_ENV=development

   # Database
   MONGODB_URI=mongodb://localhost:27017/prosper
   DB_NAME=prosper

   # Auth0 Configuration
   AUTH0_DOMAIN=your-auth0-domain.auth0.com
   AUTH0_AUDIENCE=your-auth0-audience
   AUTH0_CLIENT_ID=your-auth0-client-id
   AUTH0_CLIENT_SECRET=your-auth0-client-secret

   # Plaid Configuration (Link Token Method)
   PLAID_CLIENT_ID=your-plaid-client-id
   PLAID_SECRET=your-plaid-secret-key
   PLAID_ENV=sandbox
   PLAID_PRODUCTS=transactions
   PLAID_COUNTRY_CODES=CA
   BACKEND_URL=http://localhost:5001

   # Security
   JWT_SECRET=your-jwt-secret-key

   # Rate Limiting
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX_REQUESTS=100

   # CORS
   FRONTEND_URL=http://localhost:3000
   ```

5. **Launch the application**
   Navigate to `http://localhost:3000` in your browser.

## 📖 Usage

### Getting Started

1. **Create an Account**: Sign up using your email and a secure password.
2. **Sync Your Bank Account**: Go to the *Bank Accounts* tab and add a bank (use `user_good` / `pass_good` for sandbox).
3. **Sync Transactions**: Click the *Sync Transactions* button to fetch your bank data.
4. **Add a Transaction**: Log your first income or expense.
5. **Set Budgets**: Define budgets for your expense categories.
6. **Track Progress**: Monitor your financial goals and spending.

### Key Features Guide

#### Adding Transactions

* Click *Add Transaction*
* Choose *Income* or *Expense*
* Select a category, enter amount, description, and date
* Click *Save*

#### Creating Budgets

* Navigate to *Budgets*
* Click *Create New Budget*
* Select category, amount, and duration
* View progress with visual indicators


## 🔧 Technologies Used

### Frontend

* **React.js**
* **HTML5 & CSS3**
* **JavaScript (ES6+)**
* **Chart.js**
* **Bootstrap / Material-UI**

### Backend

* **Node.js**
* **Express.js**
* **MongoDB**
* **Auth0**
* **Plaid API**

### Tools & Deployment

* **Git**
* **npm**
* **Render**
* **ESLint / Prettier**

## 📁 Project Structure

```
Prosper/
├── client/
│   ├── public/
│   ├── src/
│   │   ├── __tests__/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── utils/
│   │   ├── views/
│   │   ├── App.css
│   │   ├── App.js
│   │   ├── auth_config.json
│   │   ├── config.js
│   │   ├── index.css
│   │   ├── index.js
│   │   └── serviceWorker.js
│   ├── .env
│   ├── package.json
├── server/
│   ├── config/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── test/
│   ├── .env
│   ├── package.json
│   └── server.js
```

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 📞 Contact

**Hoda** — [LinkedIn](https://www.linkedin.com/in/hoda-aghaei/)  
**Project Link**: [https://github.com/hoda-sa/Prosper](https://github.com/hoda-sa/Prosper)


---

**⭐ If you found this project helpful, please consider giving it a star!**  
Made with ❤️ by Hoda