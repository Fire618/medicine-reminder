import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import App from './App';
import Dashboard from './pages/Dashboard';
import Medicines from './pages/Medicines';
import History from './pages/History';
import Privacy from './pages/Privacy';
import DevVision from './pages/DevVision';
import './styles.css';

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'medicines', element: <Medicines /> },
      { path: 'history', element: <History /> },
      { path: 'privacy', element: <Privacy /> },
      { path: 'dev/vision', element: <DevVision /> },
      { path: '*', element: <Dashboard /> },
    ],
  },
]);

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

createRoot(rootEl).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
