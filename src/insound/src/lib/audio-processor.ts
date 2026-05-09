export class AudioProcessor {
    private audioContext: AudioContext;
  
    constructor() {
      this.audioContext = new AudioContext();
    }
  
    async loadAudioFile(file: File): Promise<AudioBuffer> {
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      const arrayBuffer = await file.arrayBuffer();
      return await this.audioContext.decodeAudioData(arrayBuffer);
    }
  
    async loadAudioFromUrl(url: string): Promise<AudioBuffer> {
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      return await this.audioContext.decodeAudioData(arrayBuffer);
    }
  
    generateBeepSound(duration: number, frequency = 800): AudioBuffer {
      const sampleRate = this.audioContext.sampleRate;
      const numSamples = Math.floor(duration * sampleRate);
      const buffer = this.audioContext.createBuffer(1, numSamples, sampleRate);
      const channelData = buffer.getChannelData(0);
  
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const envelope = Math.min(1, Math.min(t * 10, (duration - t) * 10));
        channelData[i] = Math.sin(2 * Math.PI * frequency * t) * 0.3 * envelope;
      }
  
      return buffer;
    }
  
    async createRedactedAudio(
      originalBuffer: AudioBuffer,
      redactionSegments: Array<{ start: number; end: number }>
    ): Promise<AudioBuffer> {
      console.log('=== Creating Redacted Audio ===');
      console.log('Original buffer duration:', originalBuffer.duration);
      console.log('Redaction segments:', redactionSegments);
      
      const sampleRate = originalBuffer.sampleRate;
      const numberOfChannels = originalBuffer.numberOfChannels;
      const length = originalBuffer.length;
  
      const redactedBuffer = this.audioContext.createBuffer(
        numberOfChannels,
        length,
        sampleRate
      );
  
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const originalData = originalBuffer.getChannelData(channel);
        const redactedData = redactedBuffer.getChannelData(channel);
        redactedData.set(originalData);
  
        for (const segment of redactionSegments) {
          const startSample = Math.floor(segment.start * sampleRate);
          const endSample = Math.floor(segment.end * sampleRate);
          const duration = segment.end - segment.start;
          
          console.log(`Redacting segment ${segment.start.toFixed(2)}s - ${segment.end.toFixed(2)}s (samples ${startSample} - ${endSample})`);
          
          const beepBuffer = this.generateBeepSound(duration);
          const beepData = beepBuffer.getChannelData(0);
  
          console.log(`Generated beep: ${beepData.length} samples`);
  
          for (let i = startSample; i < endSample && i < length; i++) {
            const beepIndex = i - startSample;
            if (beepIndex < beepData.length) {
              redactedData[i] = beepData[beepIndex];
            }
          }
        }
      }
  
      console.log('=== Redacted Audio Created ===');
      return redactedBuffer;
    }
  
    async audioBufferToWav(buffer: AudioBuffer): Promise<Blob> {
      const numberOfChannels = buffer.numberOfChannels;
      const sampleRate = buffer.sampleRate;
      const format = 1;
      const bitDepth = 16;
  
      const bytesPerSample = bitDepth / 8;
      const blockAlign = numberOfChannels * bytesPerSample;
  
      const data = new Float32Array(buffer.length * numberOfChannels);
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < buffer.length; i++) {
          data[i * numberOfChannels + channel] = channelData[i];
        }
      }
  
      const dataLength = data.length * bytesPerSample;
      const bufferLength = 44 + dataLength;
      const arrayBuffer = new ArrayBuffer(bufferLength);
      const view = new DataView(arrayBuffer);
  
      const writeString = (offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
          view.setUint8(offset + i, string.charCodeAt(i));
        }
      };
  
      writeString(0, 'RIFF');
      view.setUint32(4, bufferLength - 8, true);
      writeString(8, 'WAVE');
      writeString(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, format, true);
      view.setUint16(22, numberOfChannels, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * blockAlign, true);
      view.setUint16(32, blockAlign, true);
      view.setUint16(34, bitDepth, true);
      writeString(36, 'data');
      view.setUint32(40, dataLength, true);
  
      let offset = 44;
      for (let i = 0; i < data.length; i++) {
        const sample = Math.max(-1, Math.min(1, data[i]));
        const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        view.setInt16(offset, intSample, true);
        offset += 2;
      }
  
      return new Blob([arrayBuffer], { type: 'audio/wav' });
    }
  
    getAudioDuration(buffer: AudioBuffer): number {
      return buffer.duration;
    }
  
    validateAudioFile(file: File): { valid: boolean; error?: string } {
      const validTypes = ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/webm', 'audio/mp4'];
      
      if (!validTypes.includes(file.type) && !file.name.match(/\.(wav|mp3|ogg|webm|m4a)$/i)) {
        return {
          valid: false,
          error: 'Unsupported audio format. Please upload WAV, MP3, OGG, WebM, or M4A files.'
        };
      }
  
      const maxSize = 100 * 1024 * 1024;
      if (file.size > maxSize) {
        return {
          valid: false,
          error: 'File size exceeds 100MB limit.'
        };
      }
  
      return { valid: true };
    }
  }
  
  export const audioProcessor = new AudioProcessor();
  