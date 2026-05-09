# Requirements Document

## 1. Application Overview

### 1.1 Application Name
Voice Redaction Tool

### 1.2 Application Description
A voice redaction software that allows users to upload or record audio, transcribe it with timestamps, detect and redact sensitive information, and download the redacted audio with beep sounds replacing sensitive content.

## 2. Page Structure and Functionality

### 2.1 Main Page

#### 2.1.1 Audio Input Section
- Upload audio file button (supports common audio formats)
- Record audio button with recording controls (start/stop)
- Display uploaded file name or recording duration

#### 2.1.2 Transcription Section
- Process button to start transcription
- Display transcribed text with timestamps in format: 0:00-0:03 transcribed text
- Show processing status indicator

#### 2.1.3 Redaction Section
- Automatically detect and highlight sensitive information (names, personal identifiable information)
- Display redacted text with sensitive parts marked
- Show list of detected sensitive items

#### 2.1.4 Output Section
- Preview redacted audio player
- Download button for redacted audio file
- Redacted audio replaces sensitive segments with beep sounds based on timestamps

## 3. Business Rules and Logic

### 3.1 Audio Processing Flow
1. User uploads audio file or records audio
2. System transcribes audio with timestamps
3. System analyzes transcribed text using privacy filter model to detect sensitive information
4. System generates redacted text and marks sensitive segments
5. System creates new audio file with beep sounds replacing sensitive segments based on timestamps
6. User can download the redacted audio file

### 3.2 Sensitive Information Detection
- Use Transformer.js with OpenAI privacy filter model
- Utilize WebGPU and ONNX for processing
- Reference implementation: https://huggingface.co/spaces/lseanlon/Text-pii-privacy-redact-openai-filter-webgpu-offline-secure/blob/main/index.html

### 3.3 Speech Transcription
- Reference implementation: https://huggingface.co/spaces/ibm-granite/granite-speech-webgpu/tree/main
- Generate timestamps for each transcribed segment

### 3.4 Audio Redaction
- Replace audio segments containing sensitive information with beep sound
- Maintain original audio duration and timing
- Preserve non-sensitive audio segments

## 4. Exceptions and Edge Cases

| Scenario | Handling |
|----------|----------|
| Unsupported audio format | Display error message and list supported formats |
| Audio file too large | Display error message with size limit |
| Recording permission denied | Display error message requesting microphone access |
| No sensitive information detected | Display message indicating no redaction needed, allow download of original audio |
| Transcription fails | Display error message and allow retry |
| Model loading fails | Display error message and check browser compatibility |

## 5. Acceptance Criteria

1. Users can successfully upload audio files or record audio
2. System accurately transcribes audio with timestamps in format 0:00-0:03
3. System correctly detects sensitive information (names, PII) using the specified privacy filter model
4. Redacted text clearly shows which parts are sensitive
5. Generated audio file has beep sounds replacing sensitive segments at correct timestamps
6. Users can download the redacted audio file
7. All processing runs locally using WebGPU and ONNX

## 6. Out of Scope for Current Release

- Batch processing multiple audio files
- Custom sensitivity level adjustment
- Multiple language support
- Audio format conversion options
- Cloud storage integration
- User account system
- Editing transcription manually
- Custom beep sound selection