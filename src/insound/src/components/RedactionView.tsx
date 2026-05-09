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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle } from 'lucide-react';
import type { RedactionResult } from '@/types/types';

interface RedactionViewProps {
  redactionResult: RedactionResult | null;
}

export function RedactionView({ redactionResult }: RedactionViewProps) {
  if (!redactionResult) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Redaction Results</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No redaction results available yet
          </p>
        </CardContent>
      </Card>
    );
  }

  const { redactedText, spans } = redactionResult;

  const getEntityColor = (type: string): string => {
    const colors: Record<string, string> = {
      person: 'bg-destructive/20 text-destructive-foreground border-destructive/30',
      organization: 'bg-warning/20 text-foreground border-warning/30',
      location: 'bg-info/20 text-foreground border-info/30',
      phone: 'bg-destructive/20 text-destructive-foreground border-destructive/30',
      email: 'bg-destructive/20 text-destructive-foreground border-destructive/30',
      address: 'bg-info/20 text-foreground border-info/30',
      credit_card: 'bg-destructive/20 text-destructive-foreground border-destructive/30',
      ssn: 'bg-destructive/20 text-destructive-foreground border-destructive/30',
      ip_address: 'bg-destructive/20 text-destructive-foreground border-destructive/30',
      api_key: 'bg-destructive/20 text-destructive-foreground border-destructive/30',
      password: 'bg-destructive/20 text-destructive-foreground border-destructive/30',
      username: 'bg-warning/20 text-foreground border-warning/30',
      identifier: 'bg-warning/20 text-foreground border-warning/30',
      age: 'bg-muted text-muted-foreground border-border',
      date: 'bg-muted text-muted-foreground border-border',
      time: 'bg-muted text-muted-foreground border-border',
      money: 'bg-accent text-accent-foreground border-border',
      mixed: 'bg-primary/20 text-primary-foreground border-primary/30'
    };

    return colors[type] || 'bg-muted text-muted-foreground border-border';
  };

  const getEntityLabel = (type: string): string => {
    const labels: Record<string, string> = {
      person: 'Name',
      organization: 'Organization',
      location: 'Location',
      phone: 'Phone Number',
      email: 'Email',
      address: 'Address',
      credit_card: 'Credit Card',
      ssn: 'SSN',
      ip_address: 'IP Address',
      api_key: 'API Key',
      password: 'Password',
      username: 'Username',
      identifier: 'ID',
      age: 'Age',
      date: 'Date',
      time: 'Time',
      money: 'Money',
      mixed: 'Mixed'
    };

    return labels[type] || type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Redaction Results</CardTitle>
          {spans.length > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertCircle className="h-3 w-3" />
              {spans.length} Sensitive {spans.length === 1 ? 'Item' : 'Items'} Found
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="text-sm font-medium mb-3">Redacted Text (Audio Output Preview)</h3>
          <div className="p-4 rounded-lg bg-muted/30 border">
            <p className="text-sm leading-relaxed whitespace-pre-wrap font-mono">
              {redactedText || 'No text available'}
            </p>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            The downloaded audio will have beep sounds at positions marked with &lt;beep&gt;
          </p>
        </div>

        {spans.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-3">Detected Sensitive Information ({spans.length})</h3>
            <ScrollArea className="h-[200px] w-full">
              <div className="space-y-2 pr-4">
                {spans.map((span, index) => (
                  <div
                    key={`span-${index}`}
                    className={`
                      p-3 rounded-lg border flex items-center justify-between
                      ${getEntityColor(span.type)}
                    `}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {span.text}
                      </p>
                      <p className="text-xs opacity-80 mt-1">
                        Type: {getEntityLabel(span.type)}
                      </p>
                    </div>
                    <Badge variant="outline" className="ml-3 shrink-0">
                      {getEntityLabel(span.type)}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {spans.length === 0 && (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground">
              No sensitive information detected in the transcription
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
