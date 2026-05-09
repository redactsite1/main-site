import { audioProcessor } from './audio-processor';
import { piiDetectionService } from './pii-detector';
import type { RedactionResult } from '@/types/types';

export class AudioRedactor {
  async createRedactedAudio(
    audioBuffer: AudioBuffer,
    redactionResult: RedactionResult
  ): Promise<Blob> {
    const audioSegments = piiDetectionService.getAudioRedactionSegments(
      redactionResult.spans,
      redactionResult.segments
    );

    const redactedBuffer = await audioProcessor.createRedactedAudio(
      audioBuffer,
      audioSegments
    );

    return await audioProcessor.audioBufferToWav(redactedBuffer);
  }

  async processAudio(
    audioBuffer: AudioBuffer,
    redactionResult: RedactionResult
  ): Promise<{ blob: Blob; url: string }> {
    const blob = await this.createRedactedAudio(audioBuffer, redactionResult);
    const url = URL.createObjectURL(blob);

    return { blob, url };
  }

  downloadRedactedAudio(blob: Blob, filename = 'redacted-audio.wav'): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export const audioRedactor = new AudioRedactor();
