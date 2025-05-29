import React from "react";
import { BrowserRouter as Router, Route, Switch } from "react-router-dom";
import { Container } from "reactstrap";
import { useAuth0 } from "@auth0/auth0-react";

import Loading from "./components/Loading";
import NavBar from "./components/NavBar";
import Footer from "./components/Footer";
import Dashboard from "./components/Dashboard";
import Transactions from "./components/Transactions";
import ConnectedAccounts from "./components/ConnectedAccounts";
import TestConnection from "./components/TestConnection";

// Import FontAwesome
import initFontAwesome from "./utils/initFontAwesome";

// Import styles
import "./App.css";

// Initialize FontAwesome icons
initFontAwesome();

function App() {
  const { isLoading, error } = useAuth0();

  if (error) {
    return (
      <div className="container mt-5">
        <div className="alert alert-danger">
          <h4>Oops! Something went wrong</h4>
          <p>{error.message}</p>
          <button
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <Loading />;
  }

  return (
    <Router>
      <div id="app" className="d-flex flex-column h-100">
        <NavBar />
        <Container fluid className="flex-fill py-4">
          <Switch>
            <Route path="/" exact component={Dashboard} />
            <Route path="/transactions" component={Transactions} />
            <Route path="/accounts" component={ConnectedAccounts} />
            <Route path="/test-connection" component={TestConnection} />
            {/* Add more routes as needed */}
            <Route
              path="*"
              render={() => (
                <div className="text-center py-5">
                  <h3>Page Not Found</h3>
                  <p>The page you're looking for doesn't exist.</p>
                  <button
                    className="btn btn-primary"
                    onClick={() => window.history.back()}
                  >
                    Go Back
                  </button>
                </div>
              )}
            />
          </Switch>
        </Container>
        <Footer />
      </div>
    </Router>
  );
}

export default App;