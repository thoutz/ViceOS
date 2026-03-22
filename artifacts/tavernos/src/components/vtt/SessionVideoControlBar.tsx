import { Track } from 'livekit-client';
import * as React from 'react';
import {
  ChatIcon,
  ChatToggle,
  DisconnectButton,
  MediaDeviceMenu,
  StartMediaButton,
  TrackToggle,
  useLocalParticipantPermissions,
  usePersistentUserChoices,
  type ControlBarControls,
} from '@livekit/components-react';
import { supportsScreenSharing } from '@livekit/components-core';
import { Hand, MoreHorizontal, Phone } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const trackSourceToProtocol = (source: Track.Source) => {
  switch (source) {
    case Track.Source.Camera:
      return 1;
    case Track.Source.Microphone:
      return 2;
    case Track.Source.ScreenShare:
      return 3;
    default:
      return 0;
  }
};

export interface SessionVideoControlBarProps extends React.HTMLAttributes<HTMLDivElement> {
  controls?: ControlBarControls;
  saveUserChoices?: boolean;
  onDeviceError?: (error: { source: Track.Source; error: Error }) => void;
}

function toggleSessionFullscreen() {
  const el = document.querySelector('[data-vtt-fullscreen-root]');
  if (!el || !(el instanceof HTMLElement)) return;
  if (document.fullscreenElement) {
    void document.exitFullscreen();
  } else {
    void el.requestFullscreen?.();
  }
}

/**
 * LiveKit controls in three clusters: mic/camera, utilities, hang up — see `session-video-toolbar.css`.
 */
export function SessionVideoControlBar({
  controls,
  saveUserChoices = true,
  onDeviceError,
  className,
  ...props
}: SessionVideoControlBarProps) {
  const visibleControls = { leave: true, ...controls };
  const localPermissions = useLocalParticipantPermissions();

  if (!localPermissions) {
    visibleControls.camera = false;
    visibleControls.chat = false;
    visibleControls.microphone = false;
    visibleControls.screenShare = false;
  } else {
    const canPublishSource = (source: Track.Source) =>
      localPermissions.canPublish &&
      (localPermissions.canPublishSources.length === 0 ||
        localPermissions.canPublishSources.includes(trackSourceToProtocol(source)));

    visibleControls.camera ??= canPublishSource(Track.Source.Camera);
    visibleControls.microphone ??= canPublishSource(Track.Source.Microphone);
    visibleControls.screenShare ??= canPublishSource(Track.Source.ScreenShare);
    visibleControls.chat ??= localPermissions.canPublishData && controls?.chat;
  }

  const showIcon = true;
  const showText = false;
  const browserSupportsScreenSharing = supportsScreenSharing();

  const [isScreenShareEnabled, setIsScreenShareEnabled] = React.useState(false);

  const {
    saveAudioInputEnabled,
    saveVideoInputEnabled,
    saveAudioInputDeviceId,
    saveVideoInputDeviceId,
  } = usePersistentUserChoices({ preventSave: !saveUserChoices });

  const microphoneOnChange = React.useCallback(
    (enabled: boolean, isUserInitiated: boolean) =>
      isUserInitiated ? saveAudioInputEnabled(enabled) : null,
    [saveAudioInputEnabled],
  );

  const cameraOnChange = React.useCallback(
    (enabled: boolean, isUserInitiated: boolean) =>
      isUserInitiated ? saveVideoInputEnabled(enabled) : null,
    [saveVideoInputEnabled],
  );

  const onScreenShareChange = React.useCallback((enabled: boolean) => {
    setIsScreenShareEnabled(enabled);
  }, []);

  return (
    <div className={cn('lk-control-bar vtt-lk-toolbar', className)} {...props}>
      <div className="vtt-lk-toolbar__media">
        {visibleControls.microphone && (
          <div className="lk-button-group">
            <TrackToggle
              source={Track.Source.Microphone}
              showIcon={showIcon}
              onChange={microphoneOnChange}
              onDeviceError={(error) => onDeviceError?.({ source: Track.Source.Microphone, error })}
            >
              {showText && 'Microphone'}
            </TrackToggle>
            <div className="lk-button-group-menu">
              <MediaDeviceMenu
                kind="audioinput"
                onActiveDeviceChange={(_kind, deviceId) =>
                  saveAudioInputDeviceId(deviceId ?? 'default')
                }
              />
            </div>
          </div>
        )}
        {visibleControls.camera && (
          <div className="lk-button-group">
            <TrackToggle
              source={Track.Source.Camera}
              showIcon={showIcon}
              onChange={cameraOnChange}
              onDeviceError={(error) => onDeviceError?.({ source: Track.Source.Camera, error })}
            >
              {showText && 'Camera'}
            </TrackToggle>
            <div className="lk-button-group-menu">
              <MediaDeviceMenu
                kind="videoinput"
                onActiveDeviceChange={(_kind, deviceId) =>
                  saveVideoInputDeviceId(deviceId ?? 'default')
                }
              />
            </div>
          </div>
        )}
      </div>

      <div className="vtt-lk-toolbar__utility">
        {visibleControls.screenShare && browserSupportsScreenSharing && (
          <TrackToggle
            source={Track.Source.ScreenShare}
            captureOptions={{ audio: true, selfBrowserSurface: 'include' }}
            showIcon={showIcon}
            className="vtt-lk-utility-btn"
            onChange={onScreenShareChange}
            onDeviceError={(error) => onDeviceError?.({ source: Track.Source.ScreenShare, error })}
          >
            {showText && (isScreenShareEnabled ? 'Stop screen share' : 'Share screen')}
          </TrackToggle>
        )}
        {visibleControls.chat && (
          <ChatToggle className="vtt-lk-utility-btn">
            {showIcon && <ChatIcon />}
            {showText && 'Story'}
          </ChatToggle>
        )}
        <button
          type="button"
          className="vtt-lk-utility-btn vtt-lk-utility-btn--placeholder opacity-45 cursor-not-allowed"
          disabled
          title="Raise hand (coming soon)"
          aria-label="Raise hand (coming soon)"
        >
          <Hand className="size-5 shrink-0" strokeWidth={2} />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="lk-button vtt-lk-utility-btn" aria-label="More options">
              <MoreHorizontal className="size-5 shrink-0" strokeWidth={2} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[10rem]">
            <DropdownMenuItem onClick={() => toggleSessionFullscreen()}>Fullscreen</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {visibleControls.leave && (
        <div className="vtt-lk-toolbar__leave">
          <DisconnectButton stopTracks className="vtt-lk-hangup-btn">
            <Phone className="size-5 shrink-0" strokeWidth={2.25} aria-hidden />
          </DisconnectButton>
        </div>
      )}

      <StartMediaButton className="vtt-lk-start-media" label="Tap to play remote media (browser policy)" />
    </div>
  );
}
