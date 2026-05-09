import { pipeline, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';
import type { TranscriptionSegment } from '@/types/types';

class TranscriptionService {
  private transcriber: AutomaticSpeechRecognitionPipeline | null = null;
  private isLoading = false;
  private device: 'webgpu' | 'wasm' = 'wasm';

  private async checkWebGPUSupport(): Promise<boolean> {
    if (!navigator.gpu) {
      return false;
    }
    try {
      const adapter = await navigator.gpu.requestAdapter();
      return adapter !== null;
    } catch {
      return false;
    }
  }

  async initialize(onProgress?: (progress: number) => void): Promise<void> {
    if (this.transcriber || this.isLoading) return;

    this.isLoading = true;

    try {
      const hasWebGPU = await this.checkWebGPUSupport();
      this.device = hasWebGPU ? 'webgpu' : 'wasm';

      console.log(`Initializing transcription model with device: ${this.device}`);

      this.transcriber = await pipeline(
        'automatic-speech-recognition',
        'onnx-community/whisper-base',
        {
          device: this.device,
          dtype: this.device === 'webgpu' ? 'fp32' : 'fp32',
          progress_callback: (progressInfo: unknown) => {
            if (onProgress && typeof progressInfo === 'object' && progressInfo !== null) {
              const info = progressInfo as { progress?: number };
              if (typeof info.progress === 'number') {
                onProgress(info.progress / 100);
              }
            }
          }
        }
      );

      console.log('Transcription model loaded successfully');
    } catch (error) {
      console.error('Failed to initialize transcription model:', error);
      this.isLoading = false;

      if (this.device === 'webgpu') {
        console.log('Retrying with WASM backend...');
        this.device = 'wasm';
        this.isLoading = true;

        try {
          this.transcriber = await pipeline(
            'automatic-speech-recognition',
            'onnx-community/whisper-base',
            {
              device: 'wasm',
              dtype: 'fp32',
              progress_callback: (progressInfo: unknown) => {
                if (onProgress && typeof progressInfo === 'object' && progressInfo !== null) {
                  const info = progressInfo as { progress?: number };
                  if (typeof info.progress === 'number') {
                    onProgress(info.progress / 100);
                  }
                }
              }
            }
          );
          console.log('Transcription model loaded successfully with WASM');
        } catch (wasmError) {
          console.error('Failed to initialize with WASM:', wasmError);
          throw new Error('Failed to load transcription model. Please try refreshing the page or use a different browser.');
        }
      } else {
        throw new Error('Failed to load transcription model. Please try refreshing the page or use a different browser.');
      }
    } finally {
      this.isLoading = false;
    }
  }

  async transcribe(
    audioData: Float32Array,
    sampleRate: number,
    onProgress?: (progress: number) => void
  ): Promise<TranscriptionSegment[]> {
    if (!this.transcriber) {
      await this.initialize(onProgress);
    }

    if (!this.transcriber) {
      throw new Error('Transcription model not initialized');
    }

    try {
      console.log('Starting transcription with audio length:', audioData.length, 'sample rate:', sampleRate);

      let result: any;

      try {
        result = await this.transcriber(audioData, {
          return_timestamps: true,
          chunk_length_s: 30,
          stride_length_s: 5,
        });
      } catch (timestampError) {
        console.warn('Transcription with timestamps failed, trying without timestamps:', timestampError);
        result = await this.transcriber(audioData);
      }

      console.log('Transcription result:', result);

      const segments: TranscriptionSegment[] = [];

      if (result.chunks && Array.isArray(result.chunks)) {
        console.log('Processing chunks:', result.chunks.length);
        for (const chunk of result.chunks) {
          if (chunk.timestamp && Array.isArray(chunk.timestamp)) {
            segments.push({
              start: chunk.timestamp[0] || 0,
              end: chunk.timestamp[1] || 0,
              text: chunk.text || ''
            });
          } else if (chunk.text) {
            segments.push({
              start: 0,
              end: audioData.length / sampleRate,
              text: chunk.text
            });
          }
        }
      } else if (result.text) {
        console.log('Processing single text result');
        const text = result.text.trim();
        if (text) {
          const duration = audioData.length / sampleRate;

          const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
          const timePerSentence = duration / sentences.length;

          for (let i = 0; i < sentences.length; i++) {
            const sentence = sentences[i].trim();
            if (sentence) {
              segments.push({
                start: i * timePerSentence,
                end: (i + 1) * timePerSentence,
                text: sentence
              });
            }
          }

          if (segments.length === 0) {
            segments.push({
              start: 0,
              end: duration,
              text: text
            });
          }
        }
      }

      if (segments.length === 0) {
        console.warn('No segments generated from transcription result');
        throw new Error('No transcription generated. The audio may contain no speech or be too quiet.');
      }

      console.log('Generated segments:', segments.length);
      return this.mergeSegments(segments);
    } catch (error) {
      console.error('Transcription error:', error);
      if (error instanceof Error && error.message.includes('No transcription generated')) {
        throw error;
      }
      throw new Error('Failed to transcribe audio. The audio may be corrupted, too quiet, or in an unsupported format.');
    }
  }

  private mergeSegments(segments: TranscriptionSegment[]): TranscriptionSegment[] {
    if (segments.length === 0) return [];

    const merged: TranscriptionSegment[] = [];
    let current = { ...segments[0] };

    for (let i = 1; i < segments.length; i++) {
      const segment = segments[i];

      if (segment.start - current.end < 1.0) {
        current.end = segment.end;
        current.text += ' ' + segment.text;
      } else {
        merged.push(current);
        current = { ...segment };
      }
    }

    merged.push(current);
    return merged;
  }

  async transcribeFromAudioBuffer(
    audioBuffer: AudioBuffer,
    onProgress?: (progress: number) => void
  ): Promise<TranscriptionSegment[]> {
    console.log('Transcribing audio buffer:', {
      duration: audioBuffer.duration,
      sampleRate: audioBuffer.sampleRate,
      numberOfChannels: audioBuffer.numberOfChannels,
      length: audioBuffer.length
    });

    if (audioBuffer.duration < 0.1) {
      throw new Error('Audio is too short (less than 0.1 seconds). Please record or upload a longer audio file.');
    }

    if (audioBuffer.duration > 120) {
      throw new Error('Audio is too long (over 2 minutes). Please use a shorter audio file to avoid memory issues.');
    }

    const audioData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;

    if (audioData.length > 10000000) {
      throw new Error('Audio file is too large. Please use a shorter audio file (under 2 minutes).');
    }

    const sampleSize = Math.min(audioData.length, 100000);
    const step = Math.floor(audioData.length / sampleSize);
    let maxAmplitude = 0;

    for (let i = 0; i < audioData.length; i += step) {
      const abs = Math.abs(audioData[i]);
      if (abs > maxAmplitude) {
        maxAmplitude = abs;
      }
    }

    console.log('Audio max amplitude:', maxAmplitude);

    if (maxAmplitude < 0.001) {
      throw new Error('Audio appears to be silent or too quiet. Please check your microphone or upload a different file.');
    }

    let resampledData: Float32Array = audioData;
    if (sampleRate !== 16000) {
      console.log(`Resampling from ${sampleRate}Hz to 16000Hz`);
      try {
        resampledData = this.resampleAudio(audioData, sampleRate, 16000);
      } catch (resampleError) {
        console.error('Resampling error:', resampleError);
        throw new Error('Failed to process audio. The file may be too large or corrupted.');
      }
    }

    return await this.transcribe(resampledData, 16000, onProgress);
  }

  private resampleAudio(
    audioData: Float32Array,
    originalSampleRate: number,
    targetSampleRate: number
  ): Float32Array {
    if (originalSampleRate === targetSampleRate) {
      return audioData;
    }

    const ratio = originalSampleRate / targetSampleRate;
    const newLength = Math.round(audioData.length / ratio);

    if (newLength > 5000000) {
      throw new Error('Resampled audio would be too large. Please use a shorter audio file.');
    }

    console.log(`Resampling: ${audioData.length} samples -> ${newLength} samples`);

    const result = new Float32Array(newLength);

    const chunkSize = 100000;
    for (let start = 0; start < newLength; start += chunkSize) {
      const end = Math.min(start + chunkSize, newLength);

      for (let i = start; i < end; i++) {
        const srcIndex = i * ratio;
        const srcIndexFloor = Math.floor(srcIndex);
        const srcIndexCeil = Math.min(srcIndexFloor + 1, audioData.length - 1);
        const t = srcIndex - srcIndexFloor;

        result[i] = audioData[srcIndexFloor] * (1 - t) + audioData[srcIndexCeil] * t;
      }
    }

    return result;
  }

  isInitialized(): boolean {
    return this.transcriber !== null;
  }
}

export const transcriptionService = new TranscriptionService();
