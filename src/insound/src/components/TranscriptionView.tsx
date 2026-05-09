import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { TranscriptionSegment } from '@/types/types';

interface TranscriptionViewProps {
  segments: TranscriptionSegment[];
  highlightedSpans?: Array<{ start: number; end: number }>;
}

export function TranscriptionView({ segments, highlightedSpans = [] }: TranscriptionViewProps) {
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const isTextHighlighted = (segment: TranscriptionSegment): boolean => {
    return highlightedSpans.some(
      span => 
        (span.start >= segment.start && span.start <= segment.end) ||
        (span.end >= segment.start && span.end <= segment.end) ||
        (span.start <= segment.start && span.end >= segment.end)
    );
  };

  if (segments.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Transcription</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No transcription available yet
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Transcription</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] w-full">
          <div className="space-y-4 pr-4">
            {segments.map((segment, index) => (
              <div
                key={`segment-${index}`}
                className={`
                  p-4 rounded-lg border transition-colors
                  ${isTextHighlighted(segment) 
                    ? 'bg-destructive/10 border-destructive/30' 
                    : 'bg-muted/30 border-border'
                  }
                `}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="font-mono text-xs">
                    {formatTime(segment.start)} - {formatTime(segment.end)}
                  </Badge>
                  {isTextHighlighted(segment) && (
                    <Badge variant="destructive" className="text-xs">
                      Contains Sensitive Info
                    </Badge>
                  )}
                </div>
                <p className="text-sm leading-relaxed">
                  {segment.text}
                </p>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
