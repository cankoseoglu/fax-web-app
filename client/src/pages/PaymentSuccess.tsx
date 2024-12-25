import { useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowLeft } from "lucide-react";
import ProgressTracker from "@/components/ProgressTracker";
import { useQuery } from "@tanstack/react-query";

interface Transaction {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  documoFaxId: string;
  error?: string;
  amount: string;
  recipientNumber: string;
  pageCount: number;
  countryCode: string;
  createdAt: string;
}

export default function PaymentSuccess() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/success");

  // Get transaction ID from URL if available
  const searchParams = new URLSearchParams(window.location.search);
  const sessionId = searchParams.get('transaction_id');
  
  const { data: transaction, isLoading } = useQuery<Transaction, Error, Transaction, [string, string | null]>({
    queryKey: ['transaction', sessionId],
    queryFn: async ({ queryKey }) => {
      const [, id] = queryKey;
      if (!id) throw new Error('No session ID provided');
      const response = await fetch(`/api/transaction/${id}`);
      if (!response.ok) throw new Error('Failed to fetch transaction');
      return response.json();
    },
    enabled: !!sessionId,
    refetchInterval: (query) => 
      query.state.data?.status === 'processing' ? 2000 : false,
  });

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

            {transaction && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Recipient Number</p>
                    <p className="font-medium">{transaction.recipientNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Amount Paid</p>
                    <p className="font-medium">${parseFloat(transaction.amount).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Pages</p>
                    <p className="font-medium">{transaction.pageCount}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Country</p>
                    <p className="font-medium">{transaction.countryCode}</p>
                  </div>
                </div>

                <ProgressTracker status={transaction.status} />

                {transaction.error && (
                  <p className="text-sm text-destructive">{transaction.error}</p>
                )}
              </div>
            )}

            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => setLocation('/')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
