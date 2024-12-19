
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { parsePhoneNumberFromString, getCountries, CountryCode } from 'libphonenumber-js';
import { useState } from 'react';

const countries = getCountries().map(country => ({
  value: country,
  label: new Intl.DisplayNames(['en'], { type: 'region' }).of(country) || country
})).sort((a, b) => a.label.localeCompare(b.label));

interface CountrySelectProps {
  value: { value: string; label: string };
  onChange: (country: { value: string; label: string }) => void;
  phoneNumber: string;
  onPhoneNumberChange: (phoneNumber: string, isValid: boolean) => void;
}

export default function CountrySelect({ 
  value, 
  onChange, 
  phoneNumber, 
  onPhoneNumberChange 
}: CountrySelectProps) {
  const [isPhoneValid, setIsPhoneValid] = useState(false);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newNumber = e.target.value;
    const phoneNumber = parsePhoneNumberFromString(newNumber, value.value as CountryCode);
    const isValid = phoneNumber?.isValid() || false;
    setIsPhoneValid(isValid);
    onPhoneNumberChange(newNumber, isValid);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Recipient Country</label>
        <Select
          value={value.value}
          onValueChange={(val) => {
            const country = countries.find(c => c.value === val);
            if (country) onChange(country);
          }}
        >
          <SelectTrigger>
            <SelectValue>
              <span className="flex items-center gap-2">
                <img
                  src={`https://flagcdn.com/w20/${value.value.toLowerCase()}.png`}
                  alt={value.label}
                  className="w-5 h-auto"
                />
                {value.label}
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {countries.map((country) => (
              <SelectItem key={country.value} value={country.value}>
                <span className="flex items-center gap-2">
                  <img
                    src={`https://flagcdn.com/w20/${country.value.toLowerCase()}.png`}
                    alt={country.label}
                    className="w-5 h-auto"
                  />
                  {country.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Fax Number</label>
        <Input
          type="tel"
          value={phoneNumber}
          onChange={handlePhoneChange}
          className={isPhoneValid ? "border-green-500" : ""}
          placeholder={`Enter fax number for ${value.label}`}
        />
        {!isPhoneValid && phoneNumber && (
          <p className="text-sm text-red-500">Please enter a valid fax number</p>
        )}
      </div>
    </div>
  );
}
