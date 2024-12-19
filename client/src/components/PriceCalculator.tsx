import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";

interface PriceCalculatorProps {
  countryCode: string;
  pageCount: number;
}

// Make sure the public key exists
console.log("Stripe Key:", import.meta.env.VITE_STRIPE_PUBLIC_KEY);
if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  console.error("Stripe public key is missing");
  throw new Error("Missing Stripe public key");
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
    <div className="space-y-4">
      <div className="p-4 bg-muted rounded-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <h3 className="font-medium text-muted-foreground">Pricing Details</h3>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span>Base Price per Page:</span>
                <span className="font-medium">$0.10</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Country Multiplier ({countryCode}):</span>
                <span className="font-medium">×{countryCode === 'US' ? '1.0' : '1.5'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Number of Pages:</span>
                <span className="font-medium">{pageCount}</span>
              </div>
              <div className="h-px bg-border my-2" />
              <div className="flex items-center justify-between">
                <span className="font-medium">Total Price:</span>
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-muted-foreground">Calculating...</span>
                  </div>
                ) : (
                  <span className="text-2xl font-bold text-primary">
                    ${price?.total.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex justify-end">
            <Button
              size="lg"
              disabled={isLoading || isProcessing || pageCount === 0}
              onClick={handlePayment}
              className="min-w-[150px] transition-all duration-200 hover:scale-105"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                'Pay & Send Fax'
              )}
            </Button>
          </div>
        </div>
      </div>
      
      {pageCount === 0 && (
        <p className="text-sm text-muted-foreground text-center">
          Upload files to see pricing details
        </p>
      )}
    </div>
  );
}
