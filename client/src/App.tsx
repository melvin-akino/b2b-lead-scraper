import { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Nav from './components/Nav';
import Dashboard from './pages/Dashboard';
import Scraper from './pages/Scraper';
import Settings from './pages/Settings';
import { fetchLeads } from './lib/api';

export default function App() {
  const [leadCount, setLeadCount] = useState(0);

  useEffect(() => {
    fetchLeads().then((leads) => setLeadCount(leads.length));
  }, []);

  return (
    <div className="flex min-h-screen">
      <Nav leadCount={leadCount} />

      <main className="flex-1 ml-56 p-8 max-w-6xl">
        <Routes>
          <Route path="/"         element={<Dashboard />} />
          <Route path="/scraper"  element={<Scraper />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}
