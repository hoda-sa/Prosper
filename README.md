# Prosper 💰

A comprehensive Smart Money Management Platform designed to help you take control of your financial health and achieve your financial goals.


## ✨ Features

### Core Functionality

* **Income & Expense Tracking**: Record and categorize all your financial transactions.
* **Budget Management**: Set monthly or yearly budgets and track your spending.
* **Financial Goals**: Create and monitor your savings and financial objectives.
* **Balance Overview**: View your real-time financial standing.

### Analytics & Reporting

* **Spending Analysis**: Get a detailed breakdown of expenses by category and time period.
* **Visual Dashboards**: Interactive charts and graphs to visualize your finances.
* **Trend Analysis**: Track your spending patterns and trends over time.

### User Experience

* **Intuitive Interface**: Clean, user-friendly design for smooth navigation.
* **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices.
* **Data Security**: Secure storage and handling of your financial data.

## 🚀 Demo

**[Live demo](https://prosper-frontend.onrender.com/)**

## 🛠️ Installation

### Prerequisites

Make sure you have the following installed:

* [Node.js](https://nodejs.org/) (v14 or higher)
* [npm](https://www.npmjs.com/)
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
   cd client
   npm install
   npm start
   ```

4. **Set up environment variables**

   In both `server` and `client` directory:

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
   MONGODB_URI=mongodb://your-mongodb-atlas-uri
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

2. **🏦 SYNC YOUR BANK ACCOUNT**: Go to the *Bank Accounts* tab and add a bank  
   **⚠️ IMPORTANT: Use `user_good` / `pass_good` for sandbox testing**

3. **📊 SYNC TRANSACTIONS**: Click the *Sync Transactions* button to fetch your bank data  
   **This step is crucial to fetch your most up to date transaction history**

4. **Add a Transaction**: Log your income or expense, important for cash transactions.
5. **Set Budgets**: Define budgets for your expense categories.
6. **Track Progress**: Monitor your financial goals and spending.

### Key Features Guide

#### Comprehensive Dashboard
* Get a complete overview of all your finances and budgets at a glance
* Visual summary of income, expenses, and budget progress
* Quick access to all key financial metrics

#### Adding Transactions
* Click *Add Transaction*
* Choose *Income* or *Expense*
* Select a category, enter amount, description, and date
* Click *Save*

#### View Bank Transactions
* Browse all transactions automatically synced from your connected bank accounts
* Filter and search through your transaction history
* See real-time updates as new transactions are fetched

#### Managing Categories & Payment Methods
* Edit transaction categories to fit your needs
* Add, modify, or remove payment methods
* Organize transactions with personalized categorization

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
* **Auth0 (JWT)**
* **Plaid API**

### Tools & Deployment

* **Git**
* **npm**
* **Render**
* **mocha-chai & sinon**
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

## Future Enhancements

* **Mobile App**: Access Prosper through a mobile application.
* **Automatic Sync**: Automatically sync transactions eveytime a user logs in.
* **Export Functionality**: Export your data to CSV or PDF.
* **Financial Reports**: Generate monthly and yearly financial reports.

## 📄 License

This project is licensed under the MIT License.

## 📞 Contact

**Hoda** — [LinkedIn](https://www.linkedin.com/in/hoda-aghaei/)  
**Project Link**: [https://github.com/hoda-sa/Prosper](https://github.com/hoda-sa/Prosper)


---

**⭐ If you found this project helpful, please consider giving it a star!**  
Made with ❤️ by Hoda