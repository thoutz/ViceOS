import React, { useEffect, useCallback, useState } from 'react';
import '@livekit/components-styles';
import './session-video-toolbar.css';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
} from '@livekit/components-react';
import { SessionVideoConference } from './SessionVideoConference';
import { useCreateLivekitToken } from '@workspace/api-client-react';
import { Loader2, VideoOff, RefreshCw, Video, Mic } from 'lucide-react';
import { VttButton } from '../VttButton';
import { cn } from '@/lib/utils';

interface SessionVideoCallProps {
  campaignId: string;
  sessionId: string;
  className?: string;
}

export function SessionVideoCall({ campaignId, sessionId, className }: SessionVideoCallProps) {
  const [wantsVideo, setWantsVideo] = useState(false);
  const { mutate, data, isPending, isError, error, reset } = useCreateLivekitToken();

  const fetchToken = useCallback(() => {
    reset();
    mutate({ campaignId, sessionId });
  }, [campaignId, sessionId, mutate, reset]);

  useEffect(() => {
    if (wantsVideo) fetchToken();
  }, [wantsVideo, fetchToken]);

  const handleLeaveRoom = useCallback(() => {
    setWantsVideo(false);
    reset();
  }, [reset]);

  if (!wantsVideo) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-4 py-8 px-4 text-center rounded-md border border-border/40 bg-black/25',
          className
        )}
      >
        <div className="flex items-center gap-3 text-primary/90">
          <Video className="w-8 h-8 shrink-0" />
          <Mic className="w-6 h-6 shrink-0 opacity-80" />
        </div>
        <div className="space-y-1 max-w-sm">
          <p className="text-sm font-display text-foreground">Table video</p>
          <p className="text-xs font-sans text-muted-foreground leading-relaxed">
            Join the LiveKit room to speak with your party. After you join, use the bar under the
            video to mute the mic, turn the camera off, share screen, or leave.
          </p>
        </div>
        <VttButton type="button" size="sm" onClick={() => setWantsVideo(true)}>
          Join table video
        </VttButton>
      </div>
    );
  }

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
        <div className="flex gap-2">
          {!isConfig && (
            <VttButton type="button" variant="outline" size="sm" className="text-xs" onClick={() => fetchToken()}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Retry
            </VttButton>
          )}
          <VttButton type="button" variant="ghost" size="sm" className="text-xs" onClick={handleLeaveRoom}>
            Cancel
          </VttButton>
        </div>
      </div>
    );
  }

  return (
    <div
      data-vtt-fullscreen-root
      className={cn(
        'vtt-session-video flex flex-col flex-1 min-h-0 w-full min-h-[160px] bg-black/40 border border-border/50 rounded-md overflow-hidden',
        className
      )}
    >
      <LiveKitRoom
        token={data.token}
        serverUrl={data.url}
        connect
        audio
        video
        onDisconnected={handleLeaveRoom}
      >
        {/* Flex column so SessionVideoConference control bar stays visible (not clipped). */}
        <div className="flex h-full min-h-0 flex-1 flex-col">
          <div
            className={cn(
              'min-h-0 flex-1 flex flex-col overflow-hidden',
              '[&_.lk-video-conference]:flex [&_.lk-video-conference]:h-full [&_.lk-video-conference]:min-h-0 [&_.lk-video-conference]:flex-col',
              '[&_.lk-video-conference-inner]:min-h-0 [&_.lk-video-conference-inner]:flex-1',
              '[&_.lk-grid-layout-wrapper]:min-h-0 [&_.lk-grid-layout-wrapper]:flex-1',
              '[&_.lk-focus-layout-wrapper]:min-h-0 [&_.lk-focus-layout-wrapper]:flex-1',
              '[&_.lk-control-bar]:shrink-0'
            )}
          >
            <SessionVideoConference />
          </div>
          <div className="shrink-0 flex flex-wrap items-center justify-center gap-2 border-t border-border/40 bg-black/50 px-2 py-1.5">
            <StartAudio label="Tap to play remote audio (browser policy)" />
          </div>
          <RoomAudioRenderer />
        </div>
      </LiveKitRoom>
    </div>
  );
}
