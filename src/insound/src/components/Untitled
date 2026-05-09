import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Volume2, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { audioProcessor } from '@/lib/audio-processor';

interface SamplePIIButtonProps {
  disabled?: boolean;
}

export function SamplePIIButton({ disabled }: SamplePIIButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const sampleText = "My name is Sean Lon. My number is 010356. My address is 567 Richmond San Francisco.";

  const handleGenerate = async () => {
    if (disabled || isLoading) return;
    
    setIsLoading(true);
    toast.info('Generating sample audio with Text-to-Speech...');

    try {
      // Check if browser supports Web Speech API
      if (!window.speechSynthesis) {
        throw new Error('Text-to-Speech is not supported in your browser');
      }

      // Create audio context for recording
      const audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();
      
      // Create utterance
      const utterance = new SpeechSynthesisUtterance(sampleText);
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      // Get available voices and prefer English voices
      const voices = window.speechSynthesis.getVoices();
      const englishVoice = voices.find(voice => voice.lang.startsWith('en-')) || voices[0];
      if (englishVoice) {
        utterance.voice = englishVoice;
      }

      // Use MediaRecorder to capture the speech
      const mediaRecorder = new MediaRecorder(destination.stream);
      const audioChunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        
        // Trigger download
        const downloadUrl = URL.createObjectURL(audioBlob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = 'sample-pii-audio.webm';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);
        
        toast.success('Sample audio generated and downloaded! Upload it to test redaction.');
        setIsLoading(false);
      };

      // Start recording
      mediaRecorder.start();

      // Speak the text
      utterance.onend = () => {
        setTimeout(() => {
          mediaRecorder.stop();
          audioContext.close();
        }, 500); // Small delay to ensure all audio is captured
      };

      utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event);
        mediaRecorder.stop();
        audioContext.close();
        throw new Error('Failed to generate speech');
      };

      window.speechSynthesis.speak(utterance);

    } catch (error) {
      console.error('Error generating sample:', error);
      setIsLoading(false);
      
      if (error instanceof Error && error.message.includes('not supported')) {
        toast.error('Text-to-Speech is not supported in your browser. Please use Chrome, Edge, or Safari.');
      } else {
        toast.error('Failed to generate sample audio. Please try recording your own voice!');
      }
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
        <span className="text-sm">Generate Sample PII Audio</span>
      </div>
    </Button>
  );
}
