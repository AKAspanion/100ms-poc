import React, { useRef, useCallback } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { HMSPrebuilt } from '@100mslive/roomkit-react';

export interface HmsPrebuiltRef {
  hmsActions: unknown;
  hmsStats: unknown;
  hmsStore: unknown;
  hmsNotifications: unknown;
}

export interface HmsPrebuiltBridgeProps {
  authToken: string;
  userName?: string;
  userId?: string;
  onLeave?: () => void;
  onJoin?: () => void;
  onReady?: (ref: HmsPrebuiltRef) => void;
}

function PrebuiltInner({
  authToken,
  userName,
  userId,
  onLeave,
  onJoin,
  onReady,
}: HmsPrebuiltBridgeProps) {
  const prebuiltRef = useRef<HmsPrebuiltRef | null>(null);

  const handleJoin = useCallback(() => {
    if (prebuiltRef.current && onReady) {
      onReady(prebuiltRef.current);
    }
    onJoin?.();
  }, [onReady, onJoin]);

  return React.createElement(HMSPrebuilt, {
    ref: prebuiltRef,
    authToken,
    options: {
      userName: userName ?? undefined,
      userId: userId ?? undefined,
    },
    onLeave,
    onJoin: handleJoin,
  } as React.ComponentProps<typeof HMSPrebuilt>);
}

let reactRoot: Root | null = null;

export function mountHmsPrebuilt(
  container: HTMLElement,
  props: HmsPrebuiltBridgeProps,
): () => void {
  reactRoot = createRoot(container);
  reactRoot.render(
    React.createElement(React.StrictMode, null, React.createElement(PrebuiltInner, props)),
  );

  return () => {
    if (reactRoot && container) {
      reactRoot.unmount();
      reactRoot = null;
    }
  };
}
