import { createBrowserRouter, Navigate } from 'react-router-dom';
import App from './App.jsx';
import LandingPage from './LandingPage.jsx';

const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingPage />,
  },
  {
    path: '/review',
    element: <App />,
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);

export default router;