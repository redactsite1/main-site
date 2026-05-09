/workspace/app-bcula9k2vf29
├── public/                    # Static assets
│   ├── favicon.png
│   └── images/                # UI icons and shapes
├── src/
│   ├── components/            # React components
│   │   ├── ui/                # shadcn/ui shared components
│   │   ├── common/            # Shared logic components
│   │   ├── AudioPlayerCard.tsx
│   │   ├── AudioRecorder.tsx
│   │   ├── AudioUploader.tsx
│   │   ├── RedactionView.tsx
│   │   ├── SamplePIIButton.tsx
│   │   ├── TranscriptionView.tsx
│   │   └── dropzone.tsx
│   ├── contexts/              # React Context providers
│   ├── hooks/                 # Custom React hooks
│   ├── lib/                   # Core business logic & utilities
│   │   ├── audio-processor.ts # Audio loading and validation
│   │   ├── audio-redactor.ts  # Audio buffer manipulation (beeping)
│   │   ├── pii-detector.ts    # Sensitive data detection logic
│   │   ├── transcription.ts   # WebGPU/Transformers.js interface
│   │   └── utils.ts           # Shared Tailwind/Class helpers
│   ├── pages/                 # Main application views
│   │   ├── NotFound.tsx
│   │   ├── SamplePage.tsx
│   │   └── VoiceRedactionPage.tsx # Core Application Page
│   ├── types/                 # TypeScript interfaces
│   ├── App.tsx                # Main App entry
│   ├── routes.tsx             # Route definitions
│   ├── main.tsx               # Main entry point
│   └── index.css              # Global styles
├── docs/                      # Documentation
│   ├── prd.md                 # Product Requirements
│   └── structure.md           # Project structure (this file)
├── package.json               # Dependencies and scripts
├── tailwind.config.js         # Tailwind configuration
├── vite.config.ts             # Vite configuration
└── tsconfig.json              # TypeScript configuration
```
