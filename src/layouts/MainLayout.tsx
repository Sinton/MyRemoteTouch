import React from 'react';
import VisualBackground from '../components/VisualBackground';
import PhoneWorkbench from '../components/PhoneWorkbench';
import { TouchDebugPanel } from '../components/TouchDebugPanel';

const MainLayout: React.FC = () => {
  return (
    <main className="relative w-full h-full overflow-hidden">
      <VisualBackground />
      <PhoneWorkbench />
      <TouchDebugPanel />
    </main>
  );
};

export default MainLayout;
