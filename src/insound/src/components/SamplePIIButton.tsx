import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { audioProcessor } from '@/lib/audio-processor';
import sampleAudioUrl from '@/sample.mp3';

interface SamplePIIButtonProps {
  disabled?: boolean;
  onSampleLoaded?: (file: File, buffer: AudioBuffer) => void;
}

export function SamplePIIButton({ disabled, onSampleLoaded }: SamplePIIButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = async () => {
    if (disabled || isLoading) return;
    
    setIsLoading(true);
    toast.info('Preparing sample audio...');

    try {
      const response = await fetch(sampleAudioUrl);
      if (!response.ok) throw new Error('Could not fetch sample audio asset');
      const blob = await response.blob();
      const sampleFile = new File([blob], 'sample-audio.mp3', { type: 'audio/mpeg' });

      const downloadUrl = URL.createObjectURL(sampleFile);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = sampleFile.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      const buffer = await audioProcessor.loadAudioFile(sampleFile);
      onSampleLoaded?.(sampleFile, buffer);

      toast.success('Sample audio downloaded and loaded.');

    } catch (error) {
      console.error('Error generating sample:', error);
      toast.error('Failed to load sample audio. Please try uploading manually.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button 
      variant="outline" 
      onClick={handleGenerate}
      disabled={disabled || isLoading}
      className="flex items-center gap-2 border-primary/30 hover:border-primary/60 transition-all shadow-sm"
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
      ) : (
        <Sparkles className="h-4 w-4 text-primary" />
      )}
      <div className="flex flex-col items-start text-left leading-tight">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Try Demo</span>
        <span className="text-sm">Sample Audio</span>
      </div>
    </Button>
  );
}
