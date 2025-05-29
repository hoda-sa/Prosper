import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import * as serviceWorker from "./serviceWorker";
import { Auth0Provider } from "@auth0/auth0-react";
import { getConfig } from "./config";

// Please see https://auth0.github.io/auth0-react/interfaces/Auth0ProviderOptions.html
// for a full list of the available properties on the provider
const config = getConfig();

const providerConfig = {
  domain: config.domain,
  clientId: config.clientId,
  authorizationParams: {
    redirect_uri: window.location.origin,
    ...(config.audience ? { audience: config.audience } : null),
  },
  // IMPORTANT: These settings prevent logout on refresh
  cacheLocation: 'localstorage', // Store tokens in localStorage instead of memory
  useRefreshTokens: true, // Enable refresh tokens
  useRefreshTokensFallback: true, // Fallback to refresh tokens if needed

  // Optional: Advanced session management
  sessionCheckExpiryDays: 1, // Check session expiry daily

  // Handle redirect callback
  onRedirectCallback: (appState) => {
    // Navigate to the URL they were trying to visit when the auth flow started
    const returnTo = appState?.returnTo || window.location.pathname;
    console.log('🔄 Auth redirect callback, returning to:', returnTo);
    window.history.replaceState({}, document.title, returnTo);
  },
};

console.log('🔧 Auth0 Provider Config:', {
  domain: providerConfig.domain,
  clientId: providerConfig.clientId ? 'SET' : 'NOT SET',
  audience: config.audience,
  cacheLocation: providerConfig.cacheLocation,
  useRefreshTokens: providerConfig.useRefreshTokens
});

const root = createRoot(document.getElementById('root'));
root.render(
  <Auth0Provider {...providerConfig}>
    <App />
  </Auth0Provider>,
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();