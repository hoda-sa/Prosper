import React, { useState } from "react";
import { NavLink as RouterNavLink } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useAuth0 } from "@auth0/auth0-react";
import {
  Collapse,
  Container,
  Navbar,
  NavbarToggler,
  NavbarBrand,
  Nav,
  NavItem,
  NavLink,
  Button,
  UncontrolledDropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem,
} from "reactstrap";

const NavBar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const {
    user,
    isAuthenticated,
    loginWithRedirect,
    logout,
  } = useAuth0();

  const toggle = () => setIsOpen(!isOpen);

  const logoutWithRedirect = () =>
    logout({
      logoutParams: {
        returnTo: window.location.origin,
      }
    });

  const handleLogin = () => {
    console.log('🔄 Login button clicked');
    try {
      loginWithRedirect({
        appState: {
          returnTo: window.location.pathname
        },
        authorizationParams: {
          redirect_uri: window.location.origin,
          ...(process.env.REACT_APP_AUTH0_AUDIENCE ? {
            audience: process.env.REACT_APP_AUTH0_AUDIENCE
          } : {})
        }
      });
    } catch (error) {
      console.error('❌ Login error:', error);
    }
  };

  return (
    <div className="nav-container">
      <Navbar color="light" light expand="lg" className="shadow-sm">
        <Container fluid className="px-4">
          <NavbarBrand tag={RouterNavLink} to="/" className="d-flex align-items-center flex-shrink-0">
            <img
              src="/logo.png"
              alt="Prosper Finance Logo"
              className="navbar-logo me-2"
              width="32"
              height="32"
            />
            <strong className="brand-text">Prosper</strong>
          </NavbarBrand>

          <NavbarToggler onClick={toggle} />

          <Collapse isOpen={isOpen} navbar className="justify-content-between">
            <Nav className="mx-auto d-flex flex-row" navbar>

              {isAuthenticated && (
                <>
                  <NavItem>
                    <NavLink
                      tag={RouterNavLink}
                      to="/"
                      exact
                      activeClassName="router-link-exact-active"
                      className="d-flex align-items-center px-3"
                    >
                      <FontAwesomeIcon icon="home" className="me-2" />
                      Dashboard
                    </NavLink>
                  </NavItem>
                  <NavItem>
                    <NavLink
                      tag={RouterNavLink}
                      to="/transactions"
                      activeClassName="router-link-exact-active"
                      className="d-flex align-items-center px-3"
                    >
                      <FontAwesomeIcon icon="exchange-alt" className="me-2" />
                      Transactions
                    </NavLink>
                  </NavItem>
                  <NavItem>
                    <NavLink
                      tag={RouterNavLink}
                      to="/budgets"
                      activeClassName="router-link-exact-active"
                      className="d-flex align-items-center px-3"
                    >
                      <FontAwesomeIcon icon="chart-pie" className="me-2" />
                      Budgets
                    </NavLink>
                  </NavItem>
                  <NavItem>
                    <NavLink
                      tag={RouterNavLink}
                      to="/accounts"
                      activeClassName="router-link-exact-active"
                      className="d-flex align-items-center px-3"
                    >
                      <FontAwesomeIcon icon="university" className="me-2" />
                      Bank Accounts
                    </NavLink>
                  </NavItem>

                </>
              )}
            </Nav>

            <Nav className="flex-shrink-0" navbar>
              {!isAuthenticated && (
                <NavItem>
                  <Button
                    color="primary"
                    size="sm"
                    onClick={handleLogin}
                  >
                    <FontAwesomeIcon icon="user" className="me-2" />
                    Log in
                  </Button>
                </NavItem>
              )}
              {isAuthenticated && (
                <UncontrolledDropdown nav inNavbar>
                  <DropdownToggle nav caret className="d-flex align-items-center px-2">
                    <img
                      src={user.picture}
                      alt="Profile"
                      className="rounded-circle me-2"
                      width="32"
                      height="32"
                      style={{ objectFit: 'cover' }}
                    />
                    <span className="d-none d-xl-inline text-truncate" style={{ maxWidth: '120px' }}>
                      {user.given_name}
                    </span>
                  </DropdownToggle>
                  <DropdownMenu end>
                    <DropdownItem header>
                      <div className="text-muted small text-truncate">{user.email}</div>
                    </DropdownItem>
                    {/* <DropdownItem divider /> */}
                    <DropdownItem
                      tag={RouterNavLink}
                      to="/profile"
                      className="dropdown-profile"
                      activeClassName="router-link-exact-active"
                    >
                      <FontAwesomeIcon icon="user" className="me-2" />
                      Profile
                    </DropdownItem>

                    {/* Updating user information and settings is 
                    out of scope for this iteration of the project. */}

                    {/* <DropdownItem
                      tag={RouterNavLink}
                      to="/settings"
                      activeClassName="router-link-exact-active"
                    >
                      <FontAwesomeIcon icon="cog" className="me-2" />
                      Settings
                    </DropdownItem>
                    <DropdownItem divider /> */}
                    <DropdownItem onClick={() => logoutWithRedirect()}>
                      <FontAwesomeIcon icon="power-off" className="me-2" />
                      Log out
                    </DropdownItem>
                  </DropdownMenu>
                </UncontrolledDropdown>
              )}
            </Nav>
          </Collapse>
        </Container>
      </Navbar>
    </div>
  );
};

export default NavBar;