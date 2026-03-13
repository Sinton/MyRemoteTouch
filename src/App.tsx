import React from 'react';
import Phone from './components/Phone';

/**
 * App - The entry shell for MyRemoteTouch.
 */
const App: React.FC = () => {
  return (
    <>
      <div className="background">
        <div className="blob shape1"></div>
        <div className="blob shape2"></div>
        <div className="blob shape3"></div>
      </div>
      
      <Phone />
    </>
  );
};

export default App;
