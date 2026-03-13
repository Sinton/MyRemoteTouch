import React from 'react';
import Phone from './components/Phone';
import './index.css';

/**
 * App - The entry shell for MyRemoteTouch using Tailwind CSS.
 */
const App: React.FC = () => {
  return (
    <>
      {/* Visual Environment - Animated Blobs */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 50%, #16161d 0%, #050505 100%)' }}>
        <div className="absolute w-[40vw] h-[40vw] bg-[#7000FF] rounded-full blur-[60px] opacity-60 -top-[5vw] right-[10%] animate-float-blob"></div>
        <div className="absolute w-[35vw] h-[35vw] bg-[#0070FF] rounded-full blur-[60px] opacity-60 -bottom-[5vw] left-[5%] animate-float-blob [animation-delay:-5s]"></div>
        <div className="absolute w-[30vw] h-[30vw] bg-[#FF0060] rounded-full blur-[60px] opacity-60 bottom-[15%] right-[20%] animate-float-blob [animation-delay:-10s]"></div>
      </div>
      
      {/* Business Entity */}
      <Phone />
    </>
  );
};

export default App;
