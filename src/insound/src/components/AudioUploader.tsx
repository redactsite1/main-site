import { useCallback, useState } from 'react';
import { Upload, FileAudio } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { audioProcessor } from '@/lib/audio-processor';
import { toast } from 'sonner';

interface AudioUploaderProps {
  onAudioLoaded: (file: File, buffer: AudioBuffer) => void;
  disabled?: boolean;
}

export function AudioUploader({ onAudioLoaded, disabled }: AudioUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    const validation = audioProcessor.validateAudioFile(file);
    
    if (!validation.valid) {
      toast.error(validation.error || 'Invalid audio file');
      return;
    }

    setIsLoading(true);

    try {
      const buffer = await audioProcessor.loadAudioFile(file);
      onAudioLoaded(file, buffer);
      toast.success('Audio file loaded successfully');
    } catch (error) {
      console.error('Error loading audio:', error);
      toast.error('Failed to load audio file. Please try a different file.');
    } finally {
      setIsLoading(false);
    }
  }, [onAudioLoaded]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (disabled || isLoading) return;

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  }, [disabled, isLoading, handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled && !isLoading) {
      setIsDragging(true);
    }
  }, [disabled, isLoading]);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  return (
    <Card className="w-full">
      <CardContent className="p-8">
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`
            border-2 border-dashed rounded-lg p-12 text-center transition-colors
            ${isDragging ? 'border-primary bg-accent' : 'border-border'}
            ${disabled || isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary hover:bg-accent/50'}
          `}
        >
          <div className="flex flex-col items-center gap-4">
            {isLoading ? (
              <FileAudio className="h-12 w-12 text-muted-foreground animate-pulse" />
            ) : (
              <Upload className="h-12 w-12 text-muted-foreground" />
            )}
            
            <div className="space-y-2">
              <p className="text-base font-medium">
                {isLoading ? 'Loading audio file...' : 'Drop audio file here or click to upload'}
              </p>
              <p className="text-sm text-muted-foreground">
                Supports WAV, MP3, OGG, WebM, M4A (max 100MB)
              </p>
              <p className="text-xs text-muted-foreground">
                Recommended: Audio under 2 minutes for best performance
              </p>
            </div>

            <input
              type="file"
              accept="audio/*"
              onChange={handleFileInput}
              disabled={disabled || isLoading}
              className="hidden"
              id="audio-upload"
            />
            
            <Button
              type="button"
              variant="secondary"
              disabled={disabled || isLoading}
              onClick={() => document.getElementById('audio-upload')?.click()}
            >
              Select File
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
