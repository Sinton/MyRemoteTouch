import React, { useState, useEffect } from 'react';
import VisualBackground from '../components/VisualBackground';
import Phone from '../components/Phone';
import Skeleton from '../components/Skeleton';

const MainLayout: React.FC = () => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Smooth transition from boot
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  if (loading) return <Skeleton />;

  return (
    <main className="relative w-full h-full overflow-hidden">
      <VisualBackground />
      <Phone />
    </main>
  );
};

export default MainLayout;
