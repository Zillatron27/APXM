import { describe, it, expect } from 'vitest';
import { scopeAlerts } from '../alert-scope';
import { createTestAlert } from '../../__tests__/fixtures/factories';

describe('scopeAlerts', () => {
  const contexts = [
    { id: 'company-1', type: 'COMPANY' },
    { id: 'corp-1', type: 'CORPORATION' },
  ];

  it('splits own, other, and unreachable unread alerts', () => {
    const alerts = [
      createTestAlert({ id: 'own-1', contextId: 'company-1', read: false }),
      createTestAlert({ id: 'other-1', contextId: 'corp-1', read: false }),
      createTestAlert({ id: 'unreachable-1', contextId: 'ghost-context', read: false }),
    ];

    const result = scopeAlerts(alerts, contexts, 'company-1');

    expect(result.own.map((a) => a.id)).toEqual(['own-1']);
    expect(result.otherUnread).toBe(1);
    expect(result.dropped).toBe(1);
  });

  it('excludes read alerts from every count, regardless of context', () => {
    const alerts = [
      createTestAlert({ id: 'read-own', contextId: 'company-1', read: true }),
      createTestAlert({ id: 'read-other', contextId: 'corp-1', read: true }),
      createTestAlert({ id: 'read-unreachable', contextId: 'ghost-context', read: true }),
    ];

    const result = scopeAlerts(alerts, contexts, 'company-1');

    expect(result.own).toEqual([]);
    expect(result.otherUnread).toBe(0);
    expect(result.dropped).toBe(0);
  });

  it('ignores seen — only read determines unread status', () => {
    const alerts = [
      createTestAlert({ id: 'seen-but-unread', contextId: 'company-1', seen: true, read: false }),
    ];

    const result = scopeAlerts(alerts, contexts, 'company-1');

    expect(result.own.map((a) => a.id)).toEqual(['seen-but-unread']);
  });

  it('sorts own alerts newest first', () => {
    const alerts = [
      createTestAlert({
        id: 'older',
        contextId: 'company-1',
        read: false,
        time: { timestamp: 1000 },
      }),
      createTestAlert({
        id: 'newer',
        contextId: 'company-1',
        read: false,
        time: { timestamp: 2000 },
      }),
    ];

    const result = scopeAlerts(alerts, contexts, 'company-1');

    expect(result.own.map((a) => a.id)).toEqual(['newer', 'older']);
  });

  it('degrades to treating every unread alert as own when contexts are empty', () => {
    const alerts = [
      createTestAlert({ id: 'a', contextId: 'company-1', read: false }),
      createTestAlert({ id: 'b', contextId: 'anything-else', read: false }),
    ];

    const result = scopeAlerts(alerts, [], undefined);

    expect(result.own.map((a) => a.id).sort()).toEqual(['a', 'b']);
    expect(result.otherUnread).toBe(0);
    expect(result.dropped).toBe(0);
  });

  it('degrades the same way when contexts are present but companyContextId is undefined', () => {
    const alerts = [
      createTestAlert({ id: 'a', contextId: 'company-1', read: false }),
      createTestAlert({ id: 'b', contextId: 'corp-1', read: false }),
    ];

    const result = scopeAlerts(alerts, contexts, undefined);

    expect(result.own.map((a) => a.id).sort()).toEqual(['a', 'b']);
    expect(result.otherUnread).toBe(0);
    expect(result.dropped).toBe(0);
  });
});
