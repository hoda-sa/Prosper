# Prosper 💰

A comprehensive personal finance tracker application designed to help you take control of your financial health and achieve your financial goals.

## 📋 Table of Contents

- [Features](#features)
- [Demo](#demo)
- [Installation](#installation)
- [Usage](#usage)
- [Technologies Used](#technologies-used)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

## ✨ Features

### Core Functionality
- **Income & Expense Tracking**: Record and categorize all your financial transactions
- **Budget Management**: Set monthly/yearly budgets and track your spending against them
- **Financial Goals**: Create and monitor progress toward your savings and financial objectives
- **Balance Overview**: Real-time view of your current financial standing

### Analytics & Reporting
- **Spending Analysis**: Detailed breakdown of expenses by category and time period
- **Financial Reports**: Generate comprehensive monthly and yearly financial reports
- **Visual Dashboards**: Interactive charts and graphs to visualize your financial data
- **Trend Analysis**: Track spending patterns and financial trends over time

### User Experience
- **Intuitive Interface**: Clean, user-friendly design for easy navigation
- **Responsive Design**: Works seamlessly across desktop, tablet, and mobile devices
- **Data Security**: Secure storage and handling of your financial information
- **Export Functionality**: Export your data to CSV or PDF formats

## 🚀 Demo

[Live demo: ](https://prosper-frontend.onrender.com/)

## 🛠️ Installation

### Prerequisites

Make sure you have the following installed:
- [Node.js](https://nodejs.org/) (v14 or higher)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- [Git](https://git-scm.com/)

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
   ```bash
   # In the server directory
   cp .env.example .env
   # Edit .env file with your configuration
   ```

5. **Open your browser**
   Navigate to `http://localhost:3000` to view the application.

## 📖 Usage

### Getting Started

1. **Create an Account**: Sign up with your email and create a secure password
2. **Sync to your bank account**: Go to Bank Accounts tab and add your bank account (we are in sandbox environment, use username: `user_good` and password: `pass_good`)
3. **Sync your transactions**: Click on Sync Transactions button to pull the information from your bank accounts
4. **Add Your First Transaction**: Record your first income or expense entry
5. **Set Budgets**: Create monthly budgets for different spending categories
6. **Track Progress**: Monitor your spending and progress toward financial goals

### Key Features Guide

#### Adding Transactions
- Click the "Add Transaction" button
- Select transaction type (Income/Expense)
- Choose a category and enter the amount
- Add a description and date
- Save the transaction

#### Creating Budgets
- Navigate to the "Budgets" section
- Click "Create New Budget"
- Set category, amount, and time period
- Monitor your progress with visual indicators

#### Viewing Reports
- Access the "Reports" dashboard
- Filter by date range, category, or transaction type
- Export reports in PDF or CSV format
- Analyze spending trends with interactive charts

## 🔧 Technologies Used

### Frontend
- **React.js** - User interface library
- **HTML5 & CSS3** - Markup and styling
- **JavaScript (ES6+)** - Programming language
- **Chart.js** - Data visualization
- **Bootstrap/Material-UI** - UI component library

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web application framework
- **MongoDB/PostgreSQL** - Database
- **JWT** - Authentication

### Tools & Deployment
- **Git** - Version control
- **npm/yarn** - Package management
- **Webpack** - Module bundler
- **ESLint** - Code linting
- **Prettier** - Code formatting

## 📁 Project Structure

```
Prosper/
├── client/
│   ├── build/
│   ├── node_modules/
│   ├── public/
│   ├── src/
│   │   ├── __tests__/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── utils/
│   │   ├── views/
│   │   ├── App.css
│   │   ├── App.js
│   │   ├── App.test.js
│   │   ├── auth_config.json
│   │   ├── config.js
│   │   ├── index.css
│   │   ├── index.js
│   │   ├── serviceWorker.js
│   │   └── setupTests.js
│   ├── .env
│   ├── .nvmrc
│   ├── api-server.js
│   ├── Dockerfile
│   ├── exec.ps1
│   ├── exec.sh
│   ├── package-lock.json
│   ├── package.json
│   ├── README.md
│   ├── server.js
│   └── yarn.lock
└── server/
    ├── config/
    ├── middleware/
    ├── models/
    ├── node_modules/
    ├── routes/
    ├── test/
    ├── .env
    ├── .gitignore
    ├── package-lock.json
    ├── package.json
    ├── README.md
    └── server.js
```

## 🤝 Contributing

We welcome contributions to Prosper! Here's how you can help:

### How to Contribute

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make your changes**
4. **Commit your changes**
   ```bash
   git commit -m 'Add some amazing feature'
   ```
5. **Push to the branch**
   ```bash
   git push origin feature/amazing-feature
   ```
6. **Open a Pull Request**

### Development Guidelines

- Follow the existing code style and conventions
- Write clear, descriptive commit messages
- Add tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting

### Reporting Issues

Found a bug or have a feature request? Please:
1. Check existing issues to avoid duplicates
2. Create a new issue with a clear title and description
3. Include steps to reproduce (for bugs)
4. Add relevant labels

## 📋 Roadmap

- [ ] Mobile app development (React Native)
- [ ] Bank account integration
- [ ] Advanced financial analytics
- [ ] Multi-currency support
- [ ] Collaborative budgeting for families
- [ ] AI-powered spending insights
- [ ] Investment tracking features

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Contact

**Hoda** - [LinkedIn](https://www.linkedin.com/in/hoda-aghaei/)

**Project Link**: [https://github.com/hoda-sa/Prosper](https://github.com/hoda-sa/Prosper)

## 🙏 Acknowledgments

- Thanks to all contributors who have helped improve this project
- Inspiration from various open-source finance tracking applications
- Special thanks to the developer community for valuable feedback

---

**⭐ If you find this project helpful, please consider giving it a star!**

Made with ❤️ by Hoda