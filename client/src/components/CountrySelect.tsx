import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const countries = [
  { value: 'US', label: 'United States' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'CA', label: 'Canada' },
  { value: 'AU', label: 'Australia' },
  { value: 'FR', label: 'France' },
  { value: 'DE', label: 'Germany' },
  // Add more countries as needed
];

interface CountrySelectProps {
  value: { value: string; label: string };
  onChange: (country: { value: string; label: string }) => void;
}

export default function CountrySelect({ value, onChange }: CountrySelectProps) {
  return (
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
  );
}
