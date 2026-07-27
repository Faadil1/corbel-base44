import React, { useEffect, useState } from 'react';
import './styles.css';
import { OperationalControl } from './components/OperationalControl';

interface AppProps {}

export function App({}: AppProps) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Initialize Base44 or local API connection
    setIsReady(true);
  }, []);

  if (!isReady) {
    return (
      <div className="corbel-flex-center corbel-loading">
        <div>Initializing CORBEL...</div>
      </div>
    );
  }

  return <OperationalControl />;
}

export default App;
