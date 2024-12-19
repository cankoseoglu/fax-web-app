
import { useEffect } from 'react';
import { useLocation } from 'wouter';
import ProgressTracker from '../components/ProgressTracker';

export default function Success() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Automatically redirect to home after 5 seconds
    const timeout = setTimeout(() => {
      setLocation('/');
    }, 5000);

    return () => clearTimeout(timeout);
  }, [setLocation]);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-6">Payment Successful!</h1>
        <ProgressTracker status="processing" />
      </div>
    </div>
  );
}
