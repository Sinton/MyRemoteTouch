import React from 'react';
import VisualBackground from '../components/VisualBackground';
import Phone from '../components/Phone';

const MainLayout: React.FC = () => {
  return (
    <main className="relative w-full h-full overflow-hidden">
      <VisualBackground />
      <Phone />
    </main>
  );
};

export default MainLayout;
