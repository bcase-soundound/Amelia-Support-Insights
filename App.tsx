import React, { useState } from 'react';
import LoginForm from './components/LoginForm';
import Dashboard from './components/Dashboard';
import { ViewState } from './types';

function App() {
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.LOGIN);

  const handleLoginSuccess = () => {
    setCurrentView(ViewState.DASHBOARD);
  };

  return (
    <div className="antialiased text-slate-900">
      {currentView === ViewState.LOGIN && (
        <LoginForm onLoginSuccess={handleLoginSuccess} />
      )}
      {currentView === ViewState.DASHBOARD && (
        <Dashboard />
      )}
    </div>
  );
}

export default App;