import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useHistory } from 'react-router-dom';
import {
    Container,
    Row,
    Col,
    Card,
    CardBody,
    CardTitle,
    CardText,
    Button
} from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Loading from './Loading';

const Profile = () => {
    const { user, isAuthenticated, isLoading } = useAuth0();
    const history = useHistory();

    if (isLoading) return <Loading />;

    if (!isAuthenticated) {
        return (
            <Container className="py-5">
                <Row className="justify-content-center">
                    <Col md={8} className="text-center">
                        <h1>Access Denied</h1>
                        <p className="lead">Please log in to view your profile.</p>
                    </Col>
                </Row>
            </Container>
        );
    }

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <Container className="py-4">
            <Row className="mb-4">
                <Col>
                    <h1 className="display-4 mb-4 d-flex justify-content-center">
                        {user?.given_name ? `Welcome ${user.given_name}!` : 'Welcome Friend!'}
                    </h1>
                </Col>
            </Row>

            <Row className="justify-content-center">
                <Col lg={10} xl={8}>
                    <Card className="border-0 shadow-sm">
                        <Row className="g-0">
                            <Col md={4} className="d-flex align-items-center justify-content-center p-4">
                                <img
                                    src={user?.picture || '/imgs/person.png'}
                                    alt="Profile"
                                    className="img-fluid rounded-circle"
                                    style={{
                                        maxWidth: '300px',
                                        width: '100%',
                                        height: 'auto',
                                        objectFit: 'cover'
                                    }}
                                />
                            </Col>
                            <Col md={8}>
                                <CardBody className="p-4">
                                    <CardTitle tag="h5" className="mb-4">
                                        <FontAwesomeIcon icon="user" className="me-2 text-primary" />
                                        Your Profile:
                                    </CardTitle>

                                    <div className="mb-3">
                                        <CardText className="mb-2">
                                            <strong>Name:</strong> {user?.name || 'Not provided'}
                                        </CardText>
                                        <CardText className="mb-2">
                                            <strong>Email:</strong> {user?.email || 'Not provided'}
                                        </CardText>
                                        <CardText className="mb-4">
                                            <strong>Last Login:</strong> {user?.updated_at ? formatDate(user.updated_at) : 'Not available'}
                                        </CardText>
                                    </div>


                                </CardBody>
                            </Col>
                        </Row>
                    </Card>
                </Col>
            </Row>

            {/* Additional Profile Information */}
            <Row className="mt-4">
                <Col lg={10} xl={8} className="mx-auto">
                    <Card className="border-0 shadow-sm">
                        <CardBody>
                            <CardTitle tag="h5" className="mb-4">
                                <FontAwesomeIcon icon="link" className="me-2 text-success" />
                                Quick Links
                            </CardTitle>
                            <Row className="text-center">
                                <Col md={4} className="mb-3">
                                    <div className="pb-3 pb-md-0 pe-md-3">

                                        <div>
                                            <Button
                                                color="outline-primary"
                                                onClick={() => history.push('/transactions')}
                                                className="me-md-2"
                                            >
                                                <FontAwesomeIcon icon="exchange-alt" className="me-2" />
                                                Transactions
                                            </Button>

                                        </div>
                                    </div>
                                </Col>
                                <Col md={4} className="mb-3">
                                    <div className="pb-3 pb-md-0 pe-md-3">

                                        <Button
                                            color="outline-primary"
                                            onClick={() => history.push('/budgets')}
                                            className="me-md-2"
                                        >
                                            <FontAwesomeIcon icon="chart-pie" className="me-2" />
                                            Budgets
                                        </Button>
                                    </div>
                                </Col>
                                <Col md={4}>
                                    <div className="pb-3 pb-md-0 pe-md-3">

                                        <Button
                                            color="outline-primary"
                                            onClick={() => history.push('/accounts')}
                                            className="me-md-2"
                                        >
                                            <FontAwesomeIcon icon="university" className="me-2" />
                                            Bank Accounts
                                        </Button>
                                    </div>
                                </Col>
                            </Row>
                        </CardBody>
                    </Card>
                </Col>
            </Row>
        </Container>
    );
};

export default Profile;