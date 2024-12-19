import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface ProgressTrackerProps {
  status: 'idle' | 'processing' | 'success' | 'error';
}

export default function ProgressTracker({ status }: ProgressTrackerProps) {
  const getStatusContent = () => {
    switch (status) {
      case 'processing':
        return {
          icon: <Loader2 className="w-6 h-6 animate-spin text-primary" />,
          text: 'Sending fax...',
          progress: 50
        };
      case 'success':
        return {
          icon: <CheckCircle2 className="w-6 h-6 text-green-500" />,
          text: 'Fax sent successfully!',
          progress: 100
        };
      case 'error':
        return {
          icon: <XCircle className="w-6 h-6 text-destructive" />,
          text: 'Error sending fax',
          progress: 100
        };
      default:
        return {
          icon: null,
          text: '',
          progress: 0
        };
    }
  };

  const content = getStatusContent();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {content.icon}
        <span className="font-medium">{content.text}</span>
      </div>
      <Progress value={content.progress} />
    </div>
  );
}
