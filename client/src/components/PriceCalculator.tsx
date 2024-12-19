import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";

interface PriceCalculatorProps {
  countryCode: string;
  pageCount: number;
}

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

export default function PriceCalculator({ countryCode, pageCount }: PriceCalculatorProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: price, isLoading } = useQuery({
    queryKey: ['price', countryCode, pageCount],
    queryFn: async () => {
      const res = await fetch(`/api/price?country=${countryCode}&pages=${pageCount}`);
      if (!res.ok) throw new Error('Failed to fetch price');
      return res.json();
    },
    enabled: pageCount > 0
  });

  const handlePayment = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countryCode, pageCount }),
      });
      
      const { sessionId } = await response.json();
      const stripe = await stripePromise;
      await stripe?.redirectToCheckout({ sessionId });
    } catch (error) {
      console.error('Payment error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  if (pageCount === 0) return null;

  return (
    <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
      <div>
        <h3 className="font-medium">Total Price</h3>
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <p className="text-2xl font-bold">${price?.total.toFixed(2)}</p>
        )}
      </div>
      
      <Button
        disabled={isLoading || isProcessing || pageCount === 0}
        onClick={handlePayment}
      >
        {isProcessing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
        Pay & Send Fax
      </Button>
    </div>
  );
}
