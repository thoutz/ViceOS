import React, { useEffect, useCallback } from 'react';
import '@livekit/components-styles';
import { LiveKitRoom, VideoConference, RoomAudioRenderer } from '@livekit/components-react';
import { useCreateLivekitToken } from '@workspace/api-client-react';
import { Loader2, VideoOff, RefreshCw } from 'lucide-react';
import { VttButton } from '../VttButton';
import { cn } from '@/lib/utils';

interface SessionVideoCallProps {
  campaignId: string;
  sessionId: string;
  className?: string;
}

export function SessionVideoCall({ campaignId, sessionId, className }: SessionVideoCallProps) {
  const { mutate, data, isPending, isError, error, reset } = useCreateLivekitToken();

  const fetchToken = useCallback(() => {
    reset();
    mutate({ campaignId, sessionId });
  }, [campaignId, sessionId, mutate, reset]);

  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  if (isPending && !data) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-xs font-label">Connecting to video…</p>
      </div>
    );
  }

  if (isError || !data) {
    const status = typeof error === 'object' && error !== null && 'status' in error ? (error as { status: number }).status : undefined;
    const isConfig = status === 503;
    const message = error instanceof Error ? error.message : 'Could not join video room.';

    return (
      <div className="flex flex-col items-center gap-3 p-4 text-center">
        <VideoOff className="w-10 h-10 text-muted-foreground" />
        <p className="text-xs font-label text-muted-foreground">
          {isConfig
            ? 'Video is not configured on the server. Set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET.'
            : message}
        </p>
        {!isConfig && (
          <VttButton type="button" variant="outline" size="sm" className="text-xs" onClick={() => fetchToken()}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Retry
          </VttButton>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col flex-1 min-h-[140px] w-full bg-black/40 border border-border/50 rounded-md overflow-hidden',
        className
      )}
    >
      <LiveKitRoom token={data.token} serverUrl={data.url} connect audio video>
        <VideoConference />
        <RoomAudioRenderer />
      </LiveKitRoom>
    </div>
  );
}
