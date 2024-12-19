
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
          <SelectTrigger className="w-full">
            <SelectValue>
              <span className="flex items-center gap-2">
                <div className="relative w-6 h-4 overflow-hidden rounded shadow-sm">
                  <img
                    src={`https://flagcdn.com/w40/${value.value.toLowerCase()}.png`}
                    alt={value.label}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </div>
                <span className="font-medium">{value.label}</span>
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            <div className="sticky top-0 p-2 bg-background border-b">
              <Input
                placeholder="Search countries..."
                className="w-full"
                onChange={(e) => {
                  const searchList = document.querySelector('.country-list');
                  if (searchList) {
                    const query = e.target.value.toLowerCase();
                    Array.from(searchList.children).forEach((item: Element) => {
                      const text = item.textContent?.toLowerCase() || '';
                      (item as HTMLElement).style.display = text.includes(query) ? 'block' : 'none';
                    });
                  }
                }}
              />
            </div>
            <div className="country-list">
              {countries.map((country) => (
                <SelectItem 
                  key={country.value} 
                  value={country.value}
                  className="hover:bg-accent cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <div className="relative w-6 h-4 overflow-hidden rounded shadow-sm">
                      <img
                        src={`https://flagcdn.com/w40/${country.value.toLowerCase()}.png`}
                        alt={country.label}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    </div>
                    <span>{country.label}</span>
                  </span>
                </SelectItem>
              ))}
            </div>
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
