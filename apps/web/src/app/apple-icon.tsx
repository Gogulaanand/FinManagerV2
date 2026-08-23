import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        alignItems: 'center',
        background: '#0F766E',
        display: 'flex',
        height: '100%',
        justifyContent: 'center',
        width: '100%',
      }}
    >
      <div
        style={{
          background: '#F4F7F7',
          borderRadius: 18,
          display: 'flex',
          height: 92,
          overflow: 'hidden',
          position: 'relative',
          width: 118,
        }}
      >
        <div
          style={{
            background: '#0F766E',
            display: 'flex',
            height: 18,
            left: 0,
            position: 'absolute',
            right: 0,
            top: 24,
          }}
        />
        <div
          style={{
            alignItems: 'center',
            background: '#F4F7F7',
            borderBottomLeftRadius: 14,
            borderLeft: '8px solid #0F766E',
            borderTopLeftRadius: 14,
            display: 'flex',
            height: 34,
            justifyContent: 'center',
            position: 'absolute',
            right: 0,
            top: 48,
            width: 42,
          }}
        >
          <div
            style={{
              background: '#0F766E',
              borderRadius: 6,
              display: 'flex',
              height: 12,
              width: 12,
            }}
          />
        </div>
      </div>
    </div>,
    size,
  );
}
