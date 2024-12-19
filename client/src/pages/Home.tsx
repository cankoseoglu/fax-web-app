import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import FaxUpload from "@/components/FaxUpload";
import CountrySelect from "@/components/CountrySelect";
import PriceCalculator from "@/components/PriceCalculator";
import ProgressTracker from "@/components/ProgressTracker";
import { useState, useEffect, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const [selectedCountry, setSelectedCountry] = useState({ value: 'US', label: 'United States' });
  const [files, setFiles] = useState<File[]>([]);
  const [faxStatus, setFaxStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isPhoneValid, setIsPhoneValid] = useState(false);
  const { toast } = useToast();

  // Monitor state changes
  useEffect(() => {
    console.log('Home state updated:', {
      selectedCountry,
      filesCount: files.length,
      faxStatus,
      phoneNumber,
      isPhoneValid
    });
  }, [selectedCountry, files.length, faxStatus, phoneNumber, isPhoneValid]);

  // Reset fax status when files or country changes
  useEffect(() => {
    if (faxStatus !== 'idle') {
      setFaxStatus('idle');
    }
  }, [files, selectedCountry]);

  // Validate state before allowing fax submission
  const canSubmitFax = useMemo(() => {
    return files.length > 0 && isPhoneValid && faxStatus === 'idle';
  }, [files.length, isPhoneValid, faxStatus]);

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
              />
            </div>
          </CardContent>
        </Card>

        {faxStatus !== 'idle' && (
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
