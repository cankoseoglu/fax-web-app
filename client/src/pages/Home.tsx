import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import FaxUpload from "@/components/FaxUpload";
import CountrySelect from "@/components/CountrySelect";
import PriceCalculator from "@/components/PriceCalculator";
import ProgressTracker from "@/components/ProgressTracker";
import { useState, useEffect } from "react";
import { useSendFax, useFaxStatus } from "@/lib/api";

type UIStatus = 'pending' | 'processing' | 'completed' | 'failed';

export default function Home() {
  const [selectedCountry, setSelectedCountry] = useState({ value: 'US', label: 'United States' });
  const [files, setFiles] = useState<File[]>([]);
  const [faxStatus, setFaxStatus] = useState<UIStatus>('pending');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isPhoneValid, setIsPhoneValid] = useState(false);
  const [transactionId, setTransactionId] = useState<string>();
  const { mutateAsync: sendFax } = useSendFax();
  const { data: statusData } = useFaxStatus(transactionId);

  // Update status when transaction status changes
  useEffect(() => {
    if (statusData?.status) {
      setFaxStatus(statusData.status as UIStatus);
    }
  }, [statusData]);

  const handleFaxSend = async (paymentIntentId: string) => {
    try {
      setFaxStatus('processing');
      const result = await sendFax({
        files,
        countryCode: selectedCountry.value,
        recipientNumber: phoneNumber,
        paymentIntentId
      });
      setTransactionId(result.transactionId);
    } catch (error) {
      console.error('Failed to send fax:', error);
      setFaxStatus('failed');
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-4xl font-bold text-foreground">International Fax Service</h1>
        
        <Card>
          <CardHeader>
            <CardTitle>Send a Fax</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <CountrySelect 
                value={selectedCountry}
                onChange={setSelectedCountry}
                phoneNumber={phoneNumber}
                onPhoneNumberChange={(number, isValid) => {
                  setPhoneNumber(number);
                  setIsPhoneValid(isValid);
                }}
              />
              
              <FaxUpload 
                files={files}
                onFilesChange={setFiles}
              />
              
              <PriceCalculator 
                countryCode={selectedCountry.value}
                pageCount={files.reduce((count, file) => count + 1, 0)}
                files={files}
                phoneNumber={phoneNumber}
                onSubmit={handleFaxSend}
              />
            </div>
          </CardContent>
        </Card>

        {faxStatus !== 'pending' && (
          <Card>
            <CardContent className="py-6">
              <ProgressTracker status={faxStatus} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
