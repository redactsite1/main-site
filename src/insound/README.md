# 隐声 InSound AI - Real-Time Audio PII Redaction

A privacy-focused voice redaction application that automatically transcribes audio, detects sensitive information (PII), and generates redacted audio with beep sounds replacing sensitive content. **All processing runs 100% locally in your browser using WebGPU/WebAssembly** - your audio never leaves your device.

## Key Features

- **🔒 100% Local Processing**: All AI models run in your browser using WebGPU or WebAssembly - zero server uploads
- **🎙️ Audio Input**: Upload audio files or record directly from your microphone
- **📝 Automatic Transcription**: Convert speech to text with timestamps using Whisper AI model
- **🔍 Advanced PII Detection**: Automatically detect:
  - Names and personal identifiers
  - Phone numbers (6-11 digits, various formats)
  - Email addresses
  - Physical addresses (street addresses with or without street types)
  - Credit card numbers
  - Social Security Numbers
  - Locations and organizations
- **🔊 Audio Redaction**: Generate redacted audio with beep sounds replacing sensitive segments
- **🛡️ Privacy First**: No data sent to servers, no cloud processing, no tracking
- **💾 Download Results**: Export both redacted text and redacted audio files
- **⚡ WebGPU Accelerated**: Fast processing with hardware acceleration when available

## Example

**Input Audio:** "My name is Sean Lon. My number is 010356. My address is 567 Richmond San Francisco."

**Output Text:** "My name is <beep>. My number is <beep>. My address is <beep>."

**Output Audio:** Original audio with beep sounds replacing the sensitive information at the exact timestamps

## Browser Requirements

This application requires a modern browser with WebAssembly support:

- **Recommended**: Chrome 90+, Edge 90+, Firefox 90+
- **WebGPU Support** (optional, for faster processing): Chrome 113+, Edge 113+

## Common Issues & Troubleshooting

### PII Not Being Detected

**If names, numbers, or addresses aren't being redacted:**

1. **Check browser console (F12)** for detailed detection logs
   - Look for "Detected entity" messages
   - Verify entities have valid start/end positions
   - Check if detection score is above 0.3 threshold

2. **Common detection issues:**
   - Very short names (1-2 characters) may not be detected
   - Numbers without context may not be recognized as phone numbers
   - Addresses need street type (St, Ave, Rd) to be detected by patterns
   - Names with unusual formatting or punctuation may be missed

3. **What gets detected:**
   - **Names**: First and last names, titles (Dr., Mr., etc.)
   - **Phone Numbers**: 6-11 digits (e.g., 010356, 1234567890)
   - **Addresses**: Street addresses with numbers (e.g., "567 Richmond San Francisco")
   - **Locations**: Cities, states, countries
   - **Organizations**: Company names, institutions

4. **Duplicate word handling:**
   - If a name appears multiple times, each occurrence is tracked separately
   - The system prevents redacting the same position twice

### "Failed to transcribe audio" Error

**Possible causes and solutions:**

1. **Silent or too quiet audio**
   - Ensure your audio contains clear speech
   - Check microphone volume when recording
   - Try a different audio file

2. **Audio too short or too long**
   - Minimum: 0.1 seconds
   - Recommended: Under 1 minute for best performance
   - Maximum: 2 minutes (hard limit to prevent crashes)

3. **"Maximum call stack size exceeded" Error**
   - This means the audio file is too large to process
   - **Solution**: Use audio files under 1 minute
   - Long audio files (>2 minutes) will cause this error
   - Try splitting your audio into shorter segments

4. **First-time model loading**
   - Models download on first use (100-200MB total)
   - Wait 1-2 minutes for initial download
   - Check browser console (F12) for download progress

5. **Browser compatibility**
   - Update to the latest browser version
   - Try Chrome or Edge if using another browser
   - Clear browser cache and reload

6. **Memory issues**
   - Close other browser tabs
   - Try a shorter audio file (under 1 minute)
   - Restart your browser

### Audio Format Issues

**Supported formats:**
- WAV, MP3, OGG, WebM, M4A
- Maximum file size: 100MB
- Sample rates: Any (automatically resampled to 16kHz)

**Important limitations:**
- Audio duration: **Under 2 minutes** (recommended under 1 minute)
- Longer audio may cause "Maximum call stack size exceeded" error
- For longer recordings, split into shorter segments

### Performance Tips

- **First run**: Expect 1-2 minute delay for model downloads
- **Subsequent runs**: Much faster (models cached)
- **Shorter audio**: Processes faster and uses less memory
  - Under 30 seconds: Excellent performance
  - 30-60 seconds: Good performance
  - 60-120 seconds: May be slow, possible errors
  - Over 120 seconds: Will likely fail
- **WebGPU**: Automatically used if available for better performance

## Technical Details

### AI Models Used

- **Transcription**: Whisper Base (ONNX) - ~140MB
- **PII Detection**: BERT Base NER (ONNX) - ~110MB with enhanced pattern matching

### Detected PII Types

The system uses a hybrid approach combining AI model detection with pattern matching:

**AI Model Detection:**
- **Personal Information**: Names, organizations
- **Locations**: Cities, countries, addresses
- **Contextual Data**: Dates, times, monetary values

**Pattern-Based Detection:**
- **Contact Information**: 
  - Phone numbers: 6-11 digits (e.g., 010356, 1234567890)
  - Email addresses: standard email format
- **Physical Addresses**: 
  - Street addresses with numbers (e.g., "567 Richmond San Francisco")
  - Addresses with street types (St, Ave, Rd, etc.)
- **Financial Data**: 
  - Credit card numbers (16 digits with optional separators)
  - Social Security Numbers (XXX-XX-XXXX format)
- **Technical Data**: IP addresses (when applicable)

### Processing Pipeline

1. Load and validate audio file
2. Initialize AI models (download if first time)
3. Transcribe audio to text with timestamps
4. Detect sensitive information using BERT NER + pattern matching
5. Map detected PII to audio timestamps with character-level precision
6. Generate redacted audio with beep sounds at precise locations
7. Allow download of results

## Development

### Project Info

## Project Directory

```
├── README.md # Documentation
├── components.json # Component library configuration
├── index.html # Entry file
├── package.json # Package management
├── postcss.config.js # PostCSS configuration
├── public # Static resources directory
│   ├── favicon.png # Icon
│   └── images # Image resources
├── src # Source code directory
│   ├── App.tsx # Entry file
│   ├── components # Components directory
│   ├── context # Context directory
│   ├── db # Database configuration directory
│   ├── hooks # Common hooks directory
│   ├── index.css # Global styles
│   ├── layout # Layout directory
│   ├── lib # Utility library directory
│   ├── main.tsx # Entry file
│   ├── routes.tsx # Routing configuration
│   ├── pages # Pages directory
│   ├── services # Database interaction directory
│   ├── types # Type definitions directory
├── tsconfig.app.json # TypeScript frontend configuration file
├── tsconfig.json # TypeScript configuration file
├── tsconfig.node.json # TypeScript Node.js configuration file
└── vite.config.ts # Vite configuration file
```

## Tech Stack

Vite, TypeScript, React, Supabase

## Development Guidelines

### How to edit code locally?

You can choose [VSCode](https://code.visualstudio.com/Download) or any IDE you prefer. The only requirement is to have Node.js and npm installed.

### Environment Requirements

```
# Node.js ≥ 20
# npm ≥ 10
Example:
# node -v   # v20.18.3
# npm -v    # 10.8.2
```

### Installing Node.js on Windows

```
# Step 1: Visit the Node.js official website: https://nodejs.org/, click download. The website will automatically suggest a suitable version (32-bit or 64-bit) for your system.
# Step 2: Run the installer: Double-click the downloaded installer to run it.
# Step 3: Complete the installation: Follow the installation wizard to complete the process.
# Step 4: Verify installation: Open Command Prompt (cmd) or your IDE terminal, and type `node -v` and `npm -v` to check if Node.js and npm are installed correctly.
```

### Installing Node.js on macOS

```
# Step 1: Using Homebrew (Recommended method): Open Terminal. Type the command `brew install node` and press Enter. If Homebrew is not installed, you need to install it first by running the following command in Terminal:
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
Alternatively, use the official installer: Visit the Node.js official website. Download the macOS .pkg installer. Open the downloaded .pkg file and follow the prompts to complete the installation.
# Step 2: Verify installation: Open Command Prompt (cmd) or your IDE terminal, and type `node -v` and `npm -v` to check if Node.js and npm are installed correctly.
```

### After installation, follow these steps:

```
# Step 1: Download the code package
# Step 2: Extract the code package
# Step 3: Open the code package with your IDE and navigate into the code directory
# Step 4: In the IDE terminal, run the command to install dependencies: npm i
# Step 5: In the IDE terminal, run the command to start the development server: npm run dev -- --host 127.0.0.1
# Step 6: if step 5 failed, try this command to start the development server: npx vite --host 127.0.0.1
```

### How to develop backend services?

Configure environment variables and install relevant dependencies.If you need to use a database, please use the official version of Supabase.

## Learn More

You can also check the help documentation: Download and Building the app（ [https://intl.cloud.baidu.com/en/doc/MIAODA/s/download-and-building-the-app-en](https://intl.cloud.baidu.com/en/doc/MIAODA/s/download-and-building-the-app-en)）to learn more detailed content.
