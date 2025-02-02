import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Chat from './pages/Chat';
import ContractTemplates from './pages/ContractTemplates';
import DeploymentConsole from './pages/DeploymentConsole';
import ContractAdmin from './pages/ContractAdmin';
import Social from './pages/Social';
import BondingCurveTokens from './pages/BondingCurveTokens';
import CoinDetail from './pages/CoinDetail';

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Get current route
  const isLandingPage = window.location.pathname === '/';

  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <Navbar />
        <div className="flex">
          {!isLandingPage && <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />}
          <main className={`flex-1 ${!isLandingPage ? 'p-6 overflow-auto transition-all duration-300' : ''} ${
            !isLandingPage && isSidebarOpen ? 'ml-64' : !isLandingPage ? 'ml-16' : ''
          }`}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/templates" element={<ContractTemplates />} />
              <Route path="/deploy" element={<DeploymentConsole />} />
              <Route path="/admin" element={<ContractAdmin />} />
              <Route path="/social" element={<Social />} />
              <Route path="/bonding-tokens" element={<BondingCurveTokens />} />
              <Route path="/bonding-tokens/:id" element={<CoinDetail />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}

export default App;