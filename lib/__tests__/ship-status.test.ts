import { describe, it, expect } from 'vitest';
import { segmentStatus, STATIONARY } from '../ship-status';

describe('segmentStatus', () => {
  it('maps every known PrUn SegmentType to a glyph + label', () => {
    expect(segmentStatus('TAKE_OFF')).toEqual({ label: 'Take off', icon: '↑' });
    expect(segmentStatus('DEPARTURE')).toEqual({ label: 'Departure', icon: '↗' });
    expect(segmentStatus('TRANSIT')).toEqual({ label: 'In transit', icon: '⟶' });
    expect(segmentStatus('CHARGE')).toEqual({ label: 'Charging', icon: '±' });
    expect(segmentStatus('JUMP')).toEqual({ label: 'Jump', icon: '➾' });
    expect(segmentStatus('FLOAT')).toEqual({ label: 'Float', icon: '↑' });
    expect(segmentStatus('APPROACH')).toEqual({ label: 'Approach', icon: '↘' });
    expect(segmentStatus('LANDING')).toEqual({ label: 'Landing', icon: '↓' });
    expect(segmentStatus('LOCK')).toEqual({ label: 'Lock', icon: '⟴' });
    expect(segmentStatus('DECAY')).toEqual({ label: 'Decay', icon: '⟴' });
    expect(segmentStatus('JUMP_GATEWAY')).toEqual({ label: 'Gateway jump', icon: '⟴' });
  });

  it('title-cases an unknown segment type with no icon, not the raw enum', () => {
    expect(segmentStatus('WARP_BUBBLE')).toEqual({ label: 'Warp Bubble', icon: '' });
  });

  it('does not crash on an empty type', () => {
    expect(segmentStatus('')).toEqual({ label: 'Unknown', icon: '' });
  });

  it('STATIONARY is the parked-ship status', () => {
    expect(STATIONARY).toEqual({ label: 'Stationary', icon: '⦁' });
  });
});
