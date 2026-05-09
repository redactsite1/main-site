import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, Square, Circle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { audioProcessor } from '@/lib/audio-processor';

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob, buffer: AudioBuffer) => void;
  disabled?: boolean;
}

export function AudioRecorder({ onRecordingComplete, disabled }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setHasPermission(true);

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });

      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        
        try {
          const arrayBuffer = await blob.arrayBuffer();
          const audioContext = new AudioContext();
          const buffer = await audioContext.decodeAudioData(arrayBuffer);
          
          onRecordingComplete(blob, buffer);
          toast.success('Recording completed successfully');
        } catch (error) {
          console.error('Error processing recording:', error);
          toast.error('Failed to process recording');
        }

        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setDuration(0);

      timerRef.current = window.setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

      toast.success('Recording started');
    } catch (error) {
      console.error('Error starting recording:', error);
      setHasPermission(false);
      toast.error('Failed to access microphone. Please grant permission.');
    }
  }, [onRecordingComplete]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isRecording]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="w-full">
      <CardContent className="p-8">
        <div className="flex flex-col items-center gap-6">
          <div className="flex items-center justify-center w-24 h-24 rounded-full bg-accent">
            {isRecording ? (
              <Circle className="h-12 w-12 text-destructive fill-destructive animate-pulse" />
            ) : (
              <Mic className="h-12 w-12 text-muted-foreground" />
            )}
          </div>

          {isRecording && (
            <div className="text-center">
              <p className="text-2xl font-semibold tabular-nums">
                {formatDuration(duration)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Recording in progress
              </p>
            </div>
          )}

          {!isRecording && hasPermission === false && (
            <p className="text-sm text-destructive text-center">
              Microphone access denied. Please grant permission in your browser settings.
            </p>
          )}

          <div className="flex gap-3">
            {!isRecording ? (
              <Button
                onClick={startRecording}
                disabled={disabled}
                size="lg"
                className="gap-2"
              >
                <Mic className="h-4 w-4" />
                Start Recording
              </Button>
            ) : (
              <Button
                onClick={stopRecording}
                variant="destructive"
                size="lg"
                className="gap-2"
              >
                <Square className="h-4 w-4" />
                Stop Recording
              </Button>
            )}
          </div>

          {!isRecording && (
            <p className="text-sm text-muted-foreground text-center">
              Click to start recording audio from your microphone
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
