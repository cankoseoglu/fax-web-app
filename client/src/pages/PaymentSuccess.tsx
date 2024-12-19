import { useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowLeft } from "lucide-react";
import ProgressTracker from "@/components/ProgressTracker";
import { useFaxStatus } from "@/lib/api";

export default function PaymentSuccess() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/success");

  // Get transaction ID from URL if available
  const searchParams = new URLSearchParams(window.location.search);
  const transactionId = searchParams.get('transaction_id');
  
  const { data: statusData } = useFaxStatus(transactionId || undefined);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
              <CardTitle>Payment Successful!</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground">
              Your payment has been processed successfully. We're now preparing to send your fax.
            </p>

            {transactionId && (
              <div className="space-y-4">
                <h3 className="font-medium">Fax Status</h3>
                <ProgressTracker status={statusData?.status || 'processing'} />
              </div>
            )}

            <Button
              variant="outline"
              onClick={() => setLocation("/")}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
