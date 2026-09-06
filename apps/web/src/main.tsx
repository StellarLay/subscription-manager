import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';
import './styles/global.css';

import React from 'react';
import ReactDOM from 'react-dom/client';

import { AppProviders } from '@/app/providers/app-providers';
import { Router } from '@/app/router';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProviders>
      <Router />
    </AppProviders>
  </React.StrictMode>,
);
