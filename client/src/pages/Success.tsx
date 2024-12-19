
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ProgressTracker from '../components/ProgressTracker';

export default function Success() {
  const navigate = useNavigate();

  useEffect(() => {
    // Automatically redirect to home after 5 seconds
    const timeout = setTimeout(() => {
      navigate('/');
    }, 5000);

    return () => clearTimeout(timeout);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-6">Payment Successful!</h1>
        <ProgressTracker status="processing" />
      </div>
    </div>
  );
}
