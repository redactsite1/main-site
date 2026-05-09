export interface TranscriptionSegment {
    start: number;
    end: number;
    text: string;
  }
  
  export interface RedactionSpan {
    start: number;
    end: number;
    type: string;
    text: string;
  }
  
  export interface RedactionResult {
    originalText: string;
    redactedText: string;
    spans: RedactionSpan[];
    segments: TranscriptionSegment[];
  }
  
  export interface AudioProcessingState {
    status: 'idle' | 'loading' | 'transcribing' | 'detecting' | 'redacting' | 'complete' | 'error';
    progress: number;
    message: string;
  }
  
  export interface AudioFile {
    file: File;
    url: string;
    duration: number;
  }
  
  export interface ModelLoadingState {
    transcription: 'idle' | 'loading' | 'loaded' | 'error';
    piiDetection: 'idle' | 'loading' | 'loaded' | 'error';
  }
  