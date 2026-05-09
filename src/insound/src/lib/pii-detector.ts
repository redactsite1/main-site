import { pipeline, type TokenClassificationPipeline } from '@huggingface/transformers';
import type { RedactionResult, RedactionSpan, TranscriptionSegment } from '@/types/types';

class PIIDetectionService {
  private detector: TokenClassificationPipeline | null = null;
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
    if (this.detector || this.isLoading) return;

    this.isLoading = true;

    try {
      const hasWebGPU = await this.checkWebGPUSupport();
      this.device = hasWebGPU ? 'webgpu' : 'wasm';

      console.log(`Initializing PII detection model with device: ${this.device}`);

      // Try OpenAI privacy-filter first, fallback to Xenova/bert-base-NER if not available
      let modelName = 'Xenova/bert-base-NER';
      
      try {
        this.detector = await pipeline(
          'token-classification',
          modelName,
          {
            device: this.device,
            dtype: this.device === 'webgpu' ? 'fp32' : 'fp32',
            progress_callback: (progressInfo: unknown) => {
              if (onProgress && typeof progressInfo === 'object' && progressInfo !== null) {
                const info = progressInfo as { progress?: number };
                if (typeof info.progress === 'number') {
                  // Progress comes as 0-100, normalize to 0-1
                  onProgress(info.progress / 100);
                }
              }
            }
          }
        );

        console.log(`PII detection model (${modelName}) loaded successfully`);
      } catch (modelError) {
        console.error(`Failed to load ${modelName}:`, modelError);
        throw modelError;
      }
    } catch (error) {
      console.error('Failed to initialize PII detection model:', error);
      this.isLoading = false;
      
      if (this.device === 'webgpu') {
        console.log('Retrying with WASM backend...');
        this.device = 'wasm';
        this.isLoading = true;
        
        try {
          this.detector = await pipeline(
            'token-classification',
            'Xenova/bert-base-NER',
            {
              device: 'wasm',
              dtype: 'fp32',
              progress_callback: (progressInfo: unknown) => {
                if (onProgress && typeof progressInfo === 'object' && progressInfo !== null) {
                  const info = progressInfo as { progress?: number };
                  if (typeof info.progress === 'number') {
                    // Progress comes as 0-100, normalize to 0-1
                    onProgress(info.progress / 100);
                  }
                }
              }
            }
          );
          console.log('PII detection model (Xenova/bert-base-NER) loaded successfully with WASM');
        } catch (wasmError) {
          console.error('Failed to initialize with WASM:', wasmError);
          throw new Error('Failed to load PII detection model. Please try refreshing the page or use a different browser.');
        }
      } else {
        throw new Error('Failed to load PII detection model. Please try refreshing the page or use a different browser.');
      }
    } finally {
      this.isLoading = false;
    }
  }

  async detectPII(
    text: string,
    onProgress?: (progress: number) => void
  ): Promise<RedactionSpan[]> {
    if (!this.detector) {
      await this.initialize(onProgress);
    }

    if (!this.detector) {
      throw new Error('PII detection model not initialized');
    }

    try {
      // Use 'simple' aggregation for grouped entities
      const result = await this.detector(text, {
        aggregation_strategy: 'simple'
      });

      console.log('PII detection raw result:', result);
      console.log('Full input text:', text);

      const spans: RedactionSpan[] = [];
      const usedPositions = new Set<string>(); // Track used positions to avoid duplicates

      if (Array.isArray(result)) {
        for (const entity of result) {
          console.log('Raw entity object:', JSON.stringify(entity, null, 2));
          
          if (entity.score > 0.3) {
            const entityType = this.mapEntityType(entity.entity_group || entity.entity || '');
            
            if (this.isSensitiveEntity(entityType)) {
              // Try to get positions and text
              let start = entity.start;
              let end = entity.end;
              let entityText = entity.word || '';
              
              // If we have word but no positions, search for it in text
              if (entityText && (start === undefined || end === undefined || start === end)) {
                // Search for all occurrences and find the first unused one
                let searchStart = 0;
                let found = false;
                while (searchStart < text.length) {
                  const searchIndex = text.indexOf(entityText, searchStart);
                  if (searchIndex === -1) break;
                  
                  const posKey = `${searchIndex}-${searchIndex + entityText.length}`;
                  if (!usedPositions.has(posKey)) {
                    start = searchIndex;
                    end = searchIndex + entityText.length;
                    found = true;
                    break;
                  }
                  searchStart = searchIndex + 1;
                }
                
                if (!found) {
                  console.warn('All occurrences of word already used:', entityText);
                  continue;
                }
              }
              
              // If we have positions but no text, extract it
              if (!entityText && start !== undefined && end !== undefined && start < end) {
                entityText = text.substring(start, end);
              }
              
              console.log('Processed entity:', {
                text: entityText,
                type: entityType,
                originalType: entity.entity_group || entity.entity,
                score: entity.score,
                start: start,
                end: end
              });
              
              // Only add if we have valid text and positions
              if (entityText && start !== undefined && end !== undefined && start < end) {
                const posKey = `${start}-${end}`;
                if (!usedPositions.has(posKey)) {
                  usedPositions.add(posKey);
                  spans.push({
                    start: start,
                    end: end,
                    type: entityType,
                    text: entityText
                  });
                } else {
                  console.log('Skipping duplicate position:', posKey);
                }
              } else {
                console.warn('Skipping entity - invalid data:', {
                  entityText,
                  start,
                  end,
                  type: entityType
                });
              }
            }
          }
        }
      }

      // Add pattern-based detection for phone numbers, emails, and addresses
      const patternSpans = this.detectPatterns(text);
      console.log('Pattern-based spans:', patternSpans);
      spans.push(...patternSpans);

      const mergedSpans = this.mergeOverlappingSpans(spans);
      console.log('Final merged spans:', mergedSpans);

      return mergedSpans;
    } catch (error) {
      console.error('PII detection error:', error);
      throw new Error('Failed to detect sensitive information. Please try again.');
    }
  }

  private detectPatterns(text: string): RedactionSpan[] {
    const spans: RedactionSpan[] = [];

    // Phone numbers (various formats)
    const phonePatterns = [
      /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g,  // 123-456-7890, 123.456.7890, 123 456 7890
      /\b\d{10,11}\b/g,  // 1234567890, 12345678901
      /\b\d{6,9}\b/g,  // Shorter numbers like 010356
      /\b\(\d{3}\)\s?\d{3}[-.\s]?\d{4}\b/g,  // (123) 456-7890
    ];

    for (const pattern of phonePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        // Avoid matching years or other common numbers
        const matchedText = match[0];
        const isLikelyYear = /^(19|20)\d{2}$/.test(matchedText);
        
        if (!isLikelyYear) {
          spans.push({
            start: match.index,
            end: match.index + match[0].length,
            type: 'phone',
            text: match[0]
          });
        }
      }
    }

    // Email addresses
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    let emailMatch;
    while ((emailMatch = emailPattern.exec(text)) !== null) {
      spans.push({
        start: emailMatch.index,
        end: emailMatch.index + emailMatch[0].length,
        type: 'email',
        text: emailMatch[0]
      });
    }

    // Street addresses (multiple patterns)
    const addressPatterns = [
      // Standard: number + street name + type
      /\b\d+\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)*\s+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Way)\b/gi,
      // Number + street name + city (without street type)
      /\b\d+\s+[A-Z][a-z]+(\s+[A-Z][a-z]+){1,3}\b/g
    ];
    
    for (const pattern of addressPatterns) {
      let addressMatch;
      while ((addressMatch = pattern.exec(text)) !== null) {
        const matchedText = addressMatch[0];
        // Only add if it looks like an address (has at least 2 words after the number)
        const words = matchedText.trim().split(/\s+/);
        if (words.length >= 3) {
          spans.push({
            start: addressMatch.index,
            end: addressMatch.index + addressMatch[0].length,
            type: 'address',
            text: addressMatch[0]
          });
        }
      }
    }

    // Credit card numbers (basic pattern)
    const creditCardPattern = /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g;
    let ccMatch;
    while ((ccMatch = creditCardPattern.exec(text)) !== null) {
      spans.push({
        start: ccMatch.index,
        end: ccMatch.index + ccMatch[0].length,
        type: 'credit_card',
        text: ccMatch[0]
      });
    }

    // Social Security Numbers
    const ssnPattern = /\b\d{3}-\d{2}-\d{4}\b/g;
    let ssnMatch;
    while ((ssnMatch = ssnPattern.exec(text)) !== null) {
      spans.push({
        start: ssnMatch.index,
        end: ssnMatch.index + ssnMatch[0].length,
        type: 'ssn',
        text: ssnMatch[0]
      });
    }

    return spans;
  }

  async redactText(
    text: string,
    segments: TranscriptionSegment[],
    onProgress?: (progress: number) => void
  ): Promise<RedactionResult> {
    const spans = await this.detectPII(text, onProgress);

    let redactedText = text;
    const sortedSpans = [...spans].sort((a, b) => b.start - a.start);

    for (const span of sortedSpans) {
      const redactionMark = '<beep>';
      redactedText = 
        redactedText.substring(0, span.start) +
        redactionMark +
        redactedText.substring(span.end);
    }

    return {
      originalText: text,
      redactedText,
      spans,
      segments
    };
  }

  private mapEntityType(entity: string): string {
    const entityMap: Record<string, string> = {
      // OpenAI privacy-filter entity types
      'NAME': 'person',
      'PERSON': 'person',
      'EMAIL': 'email',
      'PHONE': 'phone',
      'PHONE_NUMBER': 'phone',
      'ADDRESS': 'address',
      'LOCATION': 'location',
      'IP_ADDRESS': 'ip_address',
      'KEY': 'api_key',
      'PASSWORD': 'password',
      'USERNAME': 'username',
      'ID': 'identifier',
      'CREDIT_CARD': 'credit_card',
      'SSN': 'ssn',
      'DATE_OF_BIRTH': 'date',
      'AGE': 'age',
      
      // Standard NER entity types (fallback)
      'PER': 'person',
      'ORG': 'organization',
      'ORGANIZATION': 'organization',
      'LOC': 'location',
      'MISC': 'misc',
      'GPE': 'location',
      'DATE': 'date',
      'TIME': 'time',
      'MONEY': 'money',
      'PERCENT': 'percent',
      'FACILITY': 'facility',
      'PRODUCT': 'product',
      'EVENT': 'event',
      'WORK_OF_ART': 'work_of_art',
      'LAW': 'law',
      'LANGUAGE': 'language',
      'NORP': 'group',
      'CARDINAL': 'number',
      'ORDINAL': 'ordinal',
      'QUANTITY': 'quantity'
    };

    return entityMap[entity.toUpperCase()] || entity.toLowerCase();
  }

  private isSensitiveEntity(entityType: string): boolean {
    const sensitiveTypes = [
      'person',
      'organization',
      'location',
      'date',
      'time',
      'money',
      'facility',
      'gpe',
      'phone',
      'email',
      'address',
      'credit_card',
      'ssn',
      'ip_address',
      'api_key',
      'password',
      'username',
      'identifier',
      'age'
    ];

    return sensitiveTypes.includes(entityType.toLowerCase());
  }

  private mergeOverlappingSpans(spans: RedactionSpan[]): RedactionSpan[] {
    if (spans.length === 0) return [];

    const sorted = [...spans].sort((a, b) => a.start - b.start);
    const merged: RedactionSpan[] = [];
    let current = { ...sorted[0] };

    for (let i = 1; i < sorted.length; i++) {
      const span = sorted[i];

      if (span.start <= current.end) {
        current.end = Math.max(current.end, span.end);
        current.text = current.text + ' ' + span.text;
        if (span.type !== current.type) {
          current.type = 'mixed';
        }
      } else {
        merged.push(current);
        current = { ...span };
      }
    }

    merged.push(current);
    return merged;
  }

  getAudioRedactionSegments(
    spans: RedactionSpan[],
    segments: TranscriptionSegment[]
  ): Array<{ start: number; end: number }> {
    console.log('=== Audio Redaction Mapping ===');
    console.log('Input spans:', spans);
    console.log('Input segments:', segments);
    
    const audioSegments: Array<{ start: number; end: number }> = [];

    // Build word-level mapping for more accurate timing
    interface WordMapping {
      word: string;
      charStart: number;
      charEnd: number;
      timeStart: number;
      timeEnd: number;
      segment: TranscriptionSegment;
    }
    
    const wordMappings: WordMapping[] = [];
    let fullText = '';
    
    for (const segment of segments) {
      const segmentStart = fullText.length;
      const segmentText = segment.text.trim();
      const words = segmentText.split(/\s+/);
      const segmentDuration = segment.end - segment.start;
      
      let currentCharPos = segmentStart;
      
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const wordCharStart = currentCharPos;
        const wordCharEnd = currentCharPos + word.length;
        
        // Estimate word timing based on word position and length
        // More accurate than pure character-based distribution
        const wordStartRatio = i / words.length;
        const wordEndRatio = (i + 1) / words.length;
        
        const wordTimeStart = segment.start + (wordStartRatio * segmentDuration);
        const wordTimeEnd = segment.start + (wordEndRatio * segmentDuration);
        
        wordMappings.push({
          word,
          charStart: wordCharStart,
          charEnd: wordCharEnd,
          timeStart: wordTimeStart,
          timeEnd: wordTimeEnd,
          segment
        });
        
        currentCharPos = wordCharEnd + 1; // +1 for space
      }
      
      fullText += segmentText + ' ';
    }

    console.log('Full text:', fullText);
    console.log('Word mappings:', wordMappings.length);

    // For each redaction span, find overlapping words
    for (const span of spans) {
      console.log(`Processing span: "${span.text}" at positions ${span.start}-${span.end}`);
      
      const overlappingWords = wordMappings.filter(wm => {
        // Check if word overlaps with span
        return !(wm.charEnd <= span.start || wm.charStart >= span.end);
      });
      
      if (overlappingWords.length === 0) {
        console.warn(`No words found for span "${span.text}"`);
        continue;
      }
      
      // Get the time range from first to last overlapping word
      const audioStart = overlappingWords[0].timeStart;
      const audioEnd = overlappingWords[overlappingWords.length - 1].timeEnd;
      
      console.log(`Overlapping words:`, overlappingWords.map(w => w.word).join(' '));
      console.log(`Mapped to audio time: ${audioStart.toFixed(3)}s - ${audioEnd.toFixed(3)}s`);
      
      if (audioEnd > audioStart) {
        // Add buffer for more complete coverage
        // Slightly larger buffer to ensure we catch the entire word
        const bufferStart = 0.08; // 80ms before
        const bufferEnd = 0.08;   // 80ms after
        
        const segment = {
          start: Math.max(0, audioStart - bufferStart),
          end: audioEnd + bufferEnd
        };
        audioSegments.push(segment);
        console.log(`Added audio segment with buffer: ${segment.start.toFixed(3)}s - ${segment.end.toFixed(3)}s`);
      } else {
        console.warn(`Skipped span "${span.text}" - invalid time range`);
      }
    }

    // Merge overlapping audio segments
    if (audioSegments.length === 0) {
      console.warn('No audio segments to redact');
      return [];
    }
    
    const sorted = audioSegments.sort((a, b) => a.start - b.start);
    const merged: Array<{ start: number; end: number }> = [];
    let current = { ...sorted[0] };
    
    for (let i = 1; i < sorted.length; i++) {
      const segment = sorted[i];
      // Merge if segments overlap or are very close (within 100ms)
      if (segment.start <= current.end + 0.1) {
        current.end = Math.max(current.end, segment.end);
      } else {
        merged.push(current);
        current = { ...segment };
      }
    }
    merged.push(current);

    console.log('Final merged audio segments:', merged);
    console.log('=== End Audio Redaction Mapping ===');

    return merged;
  }

  isInitialized(): boolean {
    return this.detector !== null;
  }
}

export const piiDetectionService = new PIIDetectionService();
