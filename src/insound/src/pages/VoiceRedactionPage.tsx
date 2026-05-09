import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AudioUploader } from '@/components/AudioUploader';
import { AudioRecorder } from '@/components/AudioRecorder';
import { SamplePIIButton } from '@/components/SamplePIIButton';
import { TranscriptionView } from '@/components/TranscriptionView';
import { RedactionView } from '@/components/RedactionView';
import { AudioPlayerCard } from '@/components/AudioPlayerCard';
import { transcriptionService } from '@/lib/transcription';
import { piiDetectionService } from '@/lib/pii-detector';
import { audioRedactor } from '@/lib/audio-redactor';
import { Loader2, AlertCircle, CheckCircle2, FileAudio, Shield, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import type { TranscriptionSegment, RedactionResult, AudioProcessingState } from '@/types/types';

export function VoiceRedactionPage() {
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [transcription, setTranscription] = useState<TranscriptionSegment[]>([]);
  const [redactionResult, setRedactionResult] = useState<RedactionResult | null>(null);
  const [redactedAudioUrl, setRedactedAudioUrl] = useState<string | null>(null);
  const [originalAudioUrl, setOriginalAudioUrl] = useState<string | null>(null);
  const [redactedAudioBlob, setRedactedAudioBlob] = useState<Blob | null>(null);
  const [processingState, setProcessingState] = useState<AudioProcessingState>({
    status: 'idle',
    progress: 0,
    message: ''
  });
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  const resultsRef = useRef<HTMLDivElement>(null);
  const stepOneRef = useRef<HTMLDivElement>(null);
  const sampleAutoStartRef = useRef(false);

  // Sync URLs with audioFile and redactedAudioBlob
  useEffect(() => {
    if (audioFile) {
      const url = URL.createObjectURL(audioFile);
      setOriginalAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setOriginalAudioUrl(null);
    }
  }, [audioFile]);

  useEffect(() => {
    if (redactedAudioBlob) {
      const url = URL.createObjectURL(redactedAudioBlob);
      setRedactedAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setRedactedAudioUrl(null);
    }
  }, [redactedAudioBlob]);

  // Auto-start processing when audio is loaded.
  // Sample audio clicks use a shorter delay so it feels immediate.
  useEffect(() => {
    if (audioBuffer && processingState.status === 'idle') {
      const delayMs = sampleAutoStartRef.current ? 200 : 1500;
      const timer = setTimeout(() => {
        sampleAutoStartRef.current = false;
        processAudio();
      }, delayMs);
      return () => clearTimeout(timer);
    }
  }, [audioBuffer, processingState.status]);

  // Auto-scroll to results when processing is complete
  useEffect(() => {
    if (processingState.status === 'complete' && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [processingState.status]);

  const handleAudioLoaded = useCallback((file: File, buffer: AudioBuffer) => {
    setAudioFile(file);
    setAudioBuffer(buffer);
    setTranscription([]);
    setRedactionResult(null);
    setRedactedAudioBlob(null);
    setProcessingState({
      status: 'idle',
      progress: 0,
      message: ''
    });
  }, []);

  const handleRecordingComplete = (blob: Blob, buffer: AudioBuffer) => {
    const file = new File([blob], 'recording.webm', { type: 'audio/webm' });
    handleAudioLoaded(file, buffer);
  };

  const handleSampleLoaded = useCallback((file: File, buffer: AudioBuffer) => {
    sampleAutoStartRef.current = true;
    handleAudioLoaded(file, buffer);
    setTimeout(() => {
      stepOneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }, [handleAudioLoaded]);

  const processAudio = useCallback(async () => {
    if (!audioBuffer) {
      toast.error('No audio loaded');
      return;
    }

    try {
      setProcessingState({
        status: 'loading',
        progress: 10,
        message: 'Initializing transcription model (this may take a minute on first load)...'
      });

      await transcriptionService.initialize((progress) => {
        setProcessingState(prev => ({
          ...prev,
          progress: 10 + progress * 20,
          message: `Loading transcription model... ${Math.round(progress * 100)}%`
        }));
      });

      setProcessingState({
        status: 'loading',
        progress: 30,
        message: 'Initializing PII detection model...'
      });

      await piiDetectionService.initialize((progress) => {
        setProcessingState(prev => ({
          ...prev,
          progress: 30 + progress * 20,
          message: `Loading PII detection model... ${Math.round(progress * 100)}%`
        }));
      });

      setProcessingState({
        status: 'transcribing',
        progress: 50,
        message: 'Transcribing audio (this may take a while for longer audio)...'
      });

      const segments = await transcriptionService.transcribeFromAudioBuffer(
        audioBuffer,
        (progress) => {
          setProcessingState(prev => ({
            ...prev,
            progress: 50 + progress * 20
          }));
        }
      );

      if (!segments || segments.length === 0) {
        throw new Error('No transcription generated. The audio may be too quiet or contain no speech.');
      }

      setTranscription(segments);

      setProcessingState({
        status: 'detecting',
        progress: 70,
        message: 'Detecting sensitive information...'
      });

      const fullText = segments.map(s => s.text).join(' ');
      const result = await piiDetectionService.redactText(
        fullText,
        segments,
        (progress) => {
          setProcessingState(prev => ({
            ...prev,
            progress: 70 + progress * 15
          }));
        }
      );

      setRedactionResult(result);

      if (result.spans.length > 0) {
        setProcessingState({
          status: 'redacting',
          progress: 85,
          message: 'Creating redacted audio...'
        });

        const { blob, url: _url } = await audioRedactor.processAudio(audioBuffer, result);
        setRedactedAudioBlob(blob);
        // redactedAudioUrl will be updated by useEffect
      }

      setProcessingState({
        status: 'complete',
        progress: 100,
        message: result.spans.length > 0 
          ? `Processing complete. Found ${result.spans.length} sensitive item(s).`
          : 'Processing complete. No sensitive information detected.'
      });

      toast.success('Audio processing completed successfully');
    } catch (error) {
      console.error('Processing error:', error);
      
      let errorMessage = 'An error occurred during processing';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Check for specific error types
        if (error.message.includes('stack') || error.message.includes('Maximum call stack')) {
          errorMessage = 'Audio file is too large or complex to process. Please use a shorter audio file (under 1 minute recommended).';
        } else if (error.message.includes('model')) {
          errorMessage += ' Try refreshing the page or using a different browser (Chrome or Edge recommended).';
        } else if (error.message.includes('memory') || error.message.includes('out of memory')) {
          errorMessage = 'Out of memory. Try using a shorter audio file (under 1 minute) or closing other browser tabs.';
        } else if (error.message.includes('too large')) {
          errorMessage = error.message + ' Try using audio under 1 minute for best results.';
        } else if (error.message.includes('too long')) {
          errorMessage = error.message;
        } else if (error.message.includes('silent') || error.message.includes('quiet')) {
          errorMessage = error.message;
        } else if (error.message.includes('transcription') && !error.message.includes('Try')) {
          errorMessage += ' The audio may be too quiet, contain no speech, or be in an unsupported format.';
        }
      }
      
      setProcessingState({
        status: 'error',
        progress: 0,
        message: errorMessage
      });
      toast.error('Failed to process audio');
    }
  }, [audioBuffer]);

  const resetAll = () => {
    setAudioBuffer(null);
    setAudioFile(null);
    setTranscription([]);
    setRedactionResult(null);
    setRedactedAudioBlob(null);
    setProcessingState({
      status: 'idle',
      progress: 0,
      message: ''
    });
  };

  const isProcessing = ['loading', 'transcribing', 'detecting', 'redacting'].includes(processingState.status);

  return (
    <div className="min-h-screen w-full bg-background">
      <style>{`
        @keyframes brandASlash {
          0%, 22% { transform: scaleX(0); }
          36%, 78% { transform: scaleX(1); }
          100% { transform: scaleX(0); }
        }
        @keyframes wavePulse {
          0%, 100% { transform: scaleY(0.35); opacity: 0.45; }
          50% { transform: scaleY(1); opacity: 1; }
        }
        @keyframes waveRedactSlash {
          0%, 30% { transform: scaleX(0); opacity: 0; }
          45%, 80% { transform: scaleX(1); opacity: 1; }
          100% { transform: scaleX(0); opacity: 0; }
        }
        .brand-a-wrap {
          position: relative;
          display: inline-block;
        }
        .brand-a-slash {
          position: absolute;
          left: -0.04em;
          right: -0.04em;
          top: 48%;
          height: 0.18em;
          border-radius: 999px;
          background: #ff1f1f;
          transform: scaleX(0);
          transform-origin: left;
          animation: brandASlash 2.8s ease-in-out infinite;
        }
        .soundwave {
          display: flex;
          justify-content: center;
          gap: 4px;
          height: 44px;
          align-items: flex-end;
          margin-bottom: 8px;
        }
        .wave-bar {
          position: relative;
          width: 6px;
          border-radius: 999px;
          background: hsl(var(--primary));
          transform-origin: bottom;
          animation: wavePulse 1.2s ease-in-out infinite;
        }
        .wave-bar.redacted::after {
          content: "";
          position: absolute;
          left: -3px;
          right: -3px;
          top: 42%;
          height: 3px;
          border-radius: 999px;
          background: #ff1f1f;
          transform: scaleX(0);
          transform-origin: left;
          animation: waveRedactSlash 2.4s ease-in-out infinite;
        }
        .info-fab {
          position: fixed;
          right: 20px;
          bottom: 20px;
          width: 48px;
          height: 48px;
          border-radius: 999px;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
          font-weight: 700;
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.22);
          z-index: 50;
        }
        .info-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.45);
          display: grid;
          place-items: center;
          z-index: 60;
          padding: 16px;
        }
        .info-card {
          width: min(680px, 100%);
          max-height: min(82vh, 760px);
          overflow-y: auto;
          border: 1px solid hsl(var(--border));
          border-radius: 12px;
          background: hsl(var(--background));
          color: hsl(var(--foreground));
          box-shadow: 0 16px 34px rgba(0, 0, 0, 0.28);
          padding: 16px;
        }
      `}</style>
      <div className="container mx-auto px-4 py-8 md:py-12 max-w-6xl">
        <div className="space-y-8">
          <div className="text-center space-y-4">
            <div className="flex flex-col items-center gap-4 mb-2">
              <div className="soundwave" aria-hidden="true">
                <span className="wave-bar" style={{ height: '16px', animationDelay: '0s' }} />
                <span className="wave-bar redacted" style={{ height: '30px', animationDelay: '0.08s' }} />
                <span className="wave-bar" style={{ height: '22px', animationDelay: '0.16s' }} />
                <span className="wave-bar" style={{ height: '36px', animationDelay: '0.24s' }} />
                <span className="wave-bar redacted" style={{ height: '40px', animationDelay: '0.32s' }} />
                <span className="wave-bar" style={{ height: '26px', animationDelay: '0.4s' }} />
                <span className="wave-bar" style={{ height: '34px', animationDelay: '0.48s' }} />
                <span className="wave-bar redacted" style={{ height: '20px', animationDelay: '0.56s' }} />
                <span className="wave-bar" style={{ height: '28px', animationDelay: '0.64s' }} />
                <span className="wave-bar" style={{ height: '14px', animationDelay: '0.72s' }} />
              </div>
              {/* <img 
                src="https://miaoda-conversation-file.s3cdn.medo.dev/user-b2iianck7ytc/conv-bcula9k2vf28/20260508/file-bhtoulu00npd.png" 
                alt="InSound Logo" 
                className="h-24 w-24 md:h-32 md:w-32 object-contain"
              /> */}
              <div className="space-y-2">
                <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-none">
                  RED
                  <span className="brand-a-wrap">
                    A
                    <span className="brand-a-slash" aria-hidden="true" />
                  </span>
                  CT
                  <span className="text-base md:text-2xl align-super ml-1">.SITE</span>
                </h1>
                <p className="text-lg md:text-xl text-muted-foreground font-medium">
                  Real-Time Audio PII Redaction
                </p>
              </div>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-primary">
              <Shield className="h-3.5 w-3.5" />
              100% Local Processing • WebGPU Accelerated • Zero Server Upload
            </div>
            <p className="text-muted-foreground max-w-2xl mx-auto text-base">
            Free! No signup, no paywall, no data sent to servers. No BS!<br/>
              Automatically detect and redact sensitive information from audio recordings. Remove names, phone numbers, addresses, and other PII with beep sounds. All processing happens locally in your browser—your audio never leaves your device.
              
            </p>
            <div style={{ opacity: 0.1, visibility: 'hidden' }} className="max-w-3xl mx-auto text-xs">
              REDACT.SITE free local audio ai redaction helps redact names, addresses, emails, phone numbers, account numbers, API keys, passwords, private words, and sensitive data in recordings with client-side privacy and secure browser processing.
            </div>
            <div className="mt-4 p-4 rounded-lg bg-accent/30 border max-w-2xl mx-auto text-left">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-foreground">Example Output:</p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/80">Input:</span> "My name is Sean Lon. My number is 010356. My address is 567 Richmond San Francisco."
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/80">Output:</span> "My name is &lt;beep&gt;. My number is &lt;beep&gt;. My address is &lt;beep&gt;."
                  </p>
                </div>
                <div className="shrink-0">
                  <SamplePIIButton 
                    disabled={processingState.status !== 'idle' && processingState.status !== 'complete' && processingState.status !== 'error'}
                    onSampleLoaded={handleSampleLoaded}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground italic mt-3 pt-3 border-t border-border/50 flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-primary" />
                💡 Tip: Check browser console (F12) for detailed detection and redaction logs
              </p>
            </div>
          </div>

          {processingState.status === 'error' && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <div className="space-y-2">
                  <p className="font-medium">{processingState.message}</p>
                  <div className="text-xs opacity-90 space-y-1">
                    <p className="font-medium">Troubleshooting tips:</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Use Chrome, Edge, or Firefox (latest version)</li>
                      <li>Ensure audio contains clear speech (not silent or too quiet)</li>
                      <li>Try a shorter audio file (under 2 minutes works best)</li>
                      <li>Check browser console (F12) for detailed error messages</li>
                      <li>Refresh the page and try again</li>
                    </ul>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {processingState.status === 'complete' && (
            <Alert className="border-primary/30 bg-primary/5">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <AlertDescription>{processingState.message}</AlertDescription>
            </Alert>
          )}

          <Card ref={stepOneRef} className={isProcessing ? 'hidden' : ''}>
            <CardHeader>
              <CardTitle>Step 1: Audio Input</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="upload" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="upload">Upload File</TabsTrigger>
                  <TabsTrigger value="record">Record Audio</TabsTrigger>
                </TabsList>
                <TabsContent value="upload">
                  <AudioUploader 
                    onAudioLoaded={handleAudioLoaded}
                    disabled={isProcessing}
                  />
                </TabsContent>
                <TabsContent value="record">
                  <AudioRecorder 
                    onRecordingComplete={handleRecordingComplete}
                    disabled={isProcessing}
                  />
                </TabsContent>
              </Tabs>

              {audioFile && (
                <div className="mt-6 space-y-3">
                  <div className="p-4 rounded-lg bg-accent/50 border flex items-center gap-3">
                    <FileAudio className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{audioFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(audioFile.size / 1024 / 1024).toFixed(2)} MB
                        {audioBuffer && ` • ${audioBuffer.duration.toFixed(1)}s • ${audioBuffer.sampleRate}Hz`}
                      </p>
                    </div>
                  </div>
                  
                  {audioBuffer && (
                    <div className="p-3 rounded-lg bg-muted/30 border text-xs">
                      <p className="font-medium mb-1 text-foreground">Audio Info:</p>
                      <ul className="space-y-0.5 ml-2 text-muted-foreground">
                        <li>Duration: {audioBuffer.duration.toFixed(2)} seconds</li>
                        <li>Sample Rate: {audioBuffer.sampleRate} Hz</li>
                        <li>Channels: {audioBuffer.numberOfChannels}</li>
                        <li>Length: {audioBuffer.length.toLocaleString()} samples</li>
                      </ul>
                      {audioBuffer.duration > 120 && (
                        <p className="mt-2 text-warning font-medium">
                          ⚠️ Audio is longer than 2 minutes. Processing may fail or be very slow.
                        </p>
                      )}
                      {audioBuffer.duration > 60 && audioBuffer.duration <= 120 && (
                        <p className="mt-2 text-muted-foreground">
                          💡 Tip: Shorter audio (under 1 minute) processes faster and more reliably.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {audioBuffer && (
            <Card>
              <CardHeader>
                <CardTitle>Step 2: Process Audio</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isProcessing && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      <p className="text-sm font-medium">{processingState.message}</p>
                    </div>
                    <Progress value={processingState.progress} className="w-full" />
                  </div>
                )}

                {!isProcessing && processingState.status !== 'complete' && (
                  <Button 
                    onClick={processAudio}
                    size="lg"
                    className="w-full md:w-auto"
                  >
                    Start Processing
                  </Button>
                )}

                {processingState.status === 'complete' && (
                  <Button 
                    onClick={resetAll}
                    variant="outline"
                    size="lg"
                    className="w-full md:w-auto"
                  >
                    Process New Audio
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {transcription.length > 0 && (
            <div ref={resultsRef} className="space-y-6">
              <div className="flex items-center gap-2">
                <div className="h-8 w-1 bg-primary rounded-full" />
                <h2 className="text-2xl font-semibold tracking-tight">Step 3: Results</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <TranscriptionView 
                  segments={transcription}
                  highlightedSpans={
                    redactionResult 
                      ? piiDetectionService.getAudioRedactionSegments(
                          redactionResult.spans,
                          redactionResult.segments
                        )
                      : []
                  }
                />
                <RedactionView redactionResult={redactionResult} />
              </div>
            </div>
          )}

          {processingState.status === 'complete' && (
            <div className="grid md:grid-cols-2 gap-6">
              <AudioPlayerCard 
                title="Original Audio"
                audioUrl={originalAudioUrl}
                filename={audioFile ? audioFile.name : 'original-audio.wav'}
              />
              <AudioPlayerCard 
                title="Redacted Audio"
                audioUrl={redactedAudioUrl}
                audioBlob={redactedAudioBlob}
                filename={audioFile ? `redacted-${audioFile.name}` : 'redacted-audio.wav'}
                showDownload={!!redactedAudioUrl}
              />
            </div>
          )}
        </div>
      </div>
      <button className="info-fab" type="button" aria-label="Open info modal" onClick={() => setIsInfoOpen(true)}>
        ?
      </button>
      {isInfoOpen && (
        <div className="info-overlay" onClick={() => setIsInfoOpen(false)}>
          <div className="info-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-2">About this tool</h3>
            <p className="text-sm text-muted-foreground mb-3">
              This tool redacts private information directly in your browser. It is built for quick, client-side masking so you can remove sensitive data before sharing notes, emails, logs, or uploads.
            </p>
            <p className="font-semibold text-sm">Supported formats</p>
            <ul className="list-disc list-inside text-sm text-muted-foreground mb-3">
              <li>Text</li>
              <li>Images</li>
              <li>PDFs</li>
              <li>Audio</li>
            </ul>
            <p className="font-semibold text-sm">What it detects and redacts</p>
            <ul className="list-disc list-inside text-sm text-muted-foreground mb-3">
              <li>Names</li>
              <li>Physical addresses</li>
              <li>Email addresses</li>
              <li>Phone numbers</li>
              <li>URLs and sensitive links</li>
              <li>Dates (including birthdates)</li>
              <li>Account numbers and financial IDs</li>
              <li>API keys, passwords, and secrets</li>
              <li>Private words and custom sensitive terms</li>
              <li>Face and eye regions in images</li>
            </ul>
            <p className="font-semibold text-sm">How it works</p>
            <p className="text-sm text-muted-foreground mb-3">
              All processing runs client-side in your browser. Files and data are not uploaded to any server. The tool automatically scans content, highlights detected items, and replaces or masks them so you can download a redacted copy.
            </p>
            <p className="font-semibold text-sm">Privacy and security</p>
            <p className="text-sm text-muted-foreground mb-3">
              No signup, no cloud uploads, and no external storage. Everything happens locally for maximum privacy and compliance.
            </p>
            <p className="font-semibold text-sm">Need help or custom options</p>
            <p className="text-sm text-muted-foreground mb-4">
              For bulk redaction, workspace installation, or custom rules, contact <a className="underline" href="mailto:seanlon@redact.site">seanlon@redact.site</a>.
            </p>
            <div className="flex justify-end">
              <Button type="button" variant="outline" onClick={() => setIsInfoOpen(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
