import { useDropzone } from 'react-dropzone';
import { Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FaxUploadProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
}

export default function FaxUpload({ files, onFilesChange }: FaxUploadProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg'],
      'application/pdf': ['.pdf']
    },
    onDrop: (acceptedFiles, rejectedFiles) => {
      // Log detailed information about the dropped files
      console.log('Files dropped:', { 
        accepted: acceptedFiles.map(f => ({ 
          name: f.name, 
          size: f.size,
          type: f.type 
        })),
        rejected: rejectedFiles.map(f => ({ 
          name: f.file.name, 
          size: f.file.size,
          type: f.file.type,
          errors: f.errors
        }))
      });

      // Handle rejected files with proper error messaging
      if (rejectedFiles.length > 0) {
        console.warn('Files rejected:', rejectedFiles);
        // Don't add rejected files to the state
        return;
      }

      // Validate file sizes
      const validFiles = acceptedFiles.filter(file => file.size <= 5 * 1024 * 1024);
      if (validFiles.length !== acceptedFiles.length) {
        console.warn('Some files exceeded size limit');
        return;
      }

      // Update state with only valid files
      onFilesChange([...files, ...validFiles]);
    },
    maxSize: 5 * 1024 * 1024, // 5MB limit
    multiple: true
  });

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-colors duration-200
          ${isDragActive ? 'border-primary bg-primary/5' : 'border-border'}
        `}
      >
        <input {...getInputProps()} />
        <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {isDragActive
            ? "Drop your files here"
            : "Drag & drop files here, or click to select"}
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Supports PDF and image files
        </p>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-2 bg-muted rounded"
            >
              <span className="text-sm truncate">{file.name}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeFile(index)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
