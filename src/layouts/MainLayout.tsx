import React from 'react';
import VisualBackground from '../components/VisualBackground';
import Phone from '../components/Phone';
import { TouchDebugPanel } from '../components/TouchDebugPanel';

const MainLayout: React.FC = () => {
  return (
    <main className="relative w-full h-full overflow-hidden">
      <VisualBackground />
      <Phone />
      <TouchDebugPanel />
    </main>
  );
};

export default MainLayout;
