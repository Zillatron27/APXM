import { describe, it, expect, beforeEach } from 'vitest';
import { createEntityStore } from '../create-entity-store';

interface TestEntity {
  id: string;
  name: string;
  value: number;
}

describe('createEntityStore', () => {
  let store: ReturnType<typeof createEntityStore<TestEntity>>;

  beforeEach(() => {
    store = createEntityStore<TestEntity>('test', (item) => item.id);
  });

  describe('initial state', () => {
    it('starts with empty entities', () => {
      expect(store.getState().entities.size).toBe(0);
    });

    it('starts with fetched=false', () => {
      expect(store.getState().fetched).toBe(false);
    });

    it('starts with null lastUpdated', () => {
      expect(store.getState().lastUpdated).toBeNull();
    });

    it('starts with null dataSource', () => {
      expect(store.getState().dataSource).toBeNull();
    });
  });

  describe('setAll', () => {
    it('replaces all entities', () => {
      store.getState().setAll([
        { id: '1', name: 'one', value: 1 },
        { id: '2', name: 'two', value: 2 },
      ]);

      expect(store.getState().entities.size).toBe(2);
      expect(store.getState().getById('1')?.name).toBe('one');
      expect(store.getState().getById('2')?.name).toBe('two');
    });

    it('overwrites existing entities', () => {
      store.getState().setAll([{ id: '1', name: 'one', value: 1 }]);
      store.getState().setAll([{ id: '2', name: 'two', value: 2 }]);

      expect(store.getState().entities.size).toBe(1);
      expect(store.getState().getById('1')).toBeUndefined();
      expect(store.getState().getById('2')?.name).toBe('two');
    });

    it('updates lastUpdated timestamp', () => {
      const before = Date.now();
      store.getState().setAll([{ id: '1', name: 'one', value: 1 }]);
      const after = Date.now();

      const lastUpdated = store.getState().lastUpdated;
      expect(lastUpdated).not.toBeNull();
      expect(lastUpdated).toBeGreaterThanOrEqual(before);
      expect(lastUpdated).toBeLessThanOrEqual(after);
    });
  });

  describe('setOne', () => {
    it('adds a new entity', () => {
      store.getState().setOne({ id: '1', name: 'one', value: 1 });

      expect(store.getState().entities.size).toBe(1);
      expect(store.getState().getById('1')?.name).toBe('one');
    });

    it('updates an existing entity', () => {
      store.getState().setOne({ id: '1', name: 'one', value: 1 });
      store.getState().setOne({ id: '1', name: 'updated', value: 2 });

      expect(store.getState().entities.size).toBe(1);
      expect(store.getState().getById('1')?.name).toBe('updated');
      expect(store.getState().getById('1')?.value).toBe(2);
    });
  });

  describe('setMany', () => {
    it('adds multiple entities without clearing existing', () => {
      store.getState().setOne({ id: '1', name: 'one', value: 1 });
      store.getState().setMany([
        { id: '2', name: 'two', value: 2 },
        { id: '3', name: 'three', value: 3 },
      ]);

      expect(store.getState().entities.size).toBe(3);
    });

    it('updates existing entities while adding new', () => {
      store.getState().setOne({ id: '1', name: 'one', value: 1 });
      store.getState().setMany([
        { id: '1', name: 'updated', value: 10 },
        { id: '2', name: 'two', value: 2 },
      ]);

      expect(store.getState().entities.size).toBe(2);
      expect(store.getState().getById('1')?.name).toBe('updated');
    });
  });

  describe('removeOne', () => {
    it('removes an entity by id', () => {
      store.getState().setAll([
        { id: '1', name: 'one', value: 1 },
        { id: '2', name: 'two', value: 2 },
      ]);
      store.getState().removeOne('1');

      expect(store.getState().entities.size).toBe(1);
      expect(store.getState().getById('1')).toBeUndefined();
      expect(store.getState().getById('2')?.name).toBe('two');
    });

    it('handles removing non-existent id gracefully', () => {
      store.getState().setOne({ id: '1', name: 'one', value: 1 });
      store.getState().removeOne('nonexistent');

      expect(store.getState().entities.size).toBe(1);
    });
  });

  describe('clear', () => {
    it('removes all entities', () => {
      store.getState().setAll([
        { id: '1', name: 'one', value: 1 },
        { id: '2', name: 'two', value: 2 },
      ]);
      store.getState().clear();

      expect(store.getState().entities.size).toBe(0);
    });

    it('resets fetched to false', () => {
      store.getState().setFetched('websocket');
      store.getState().clear();

      expect(store.getState().fetched).toBe(false);
    });

    it('resets lastUpdated to null', () => {
      store.getState().setOne({ id: '1', name: 'one', value: 1 });
      store.getState().clear();

      expect(store.getState().lastUpdated).toBeNull();
    });

    it('resets dataSource to null', () => {
      store.getState().setFetched('fio');
      store.getState().clear();

      expect(store.getState().dataSource).toBeNull();
    });
  });

  describe('setFetched', () => {
    it('sets fetched=true and tracks source', () => {
      store.getState().setFetched('websocket');

      expect(store.getState().fetched).toBe(true);
      expect(store.getState().dataSource).toBe('websocket');
    });

    it('can update source from websocket to fio', () => {
      store.getState().setFetched('websocket');
      store.getState().setFetched('fio');

      expect(store.getState().dataSource).toBe('fio');
    });
  });

  describe('getAll', () => {
    it('returns all entities as an array', () => {
      store.getState().setAll([
        { id: '1', name: 'one', value: 1 },
        { id: '2', name: 'two', value: 2 },
      ]);

      const all = store.getState().getAll();

      expect(all).toHaveLength(2);
      expect(all.map((e) => e.id).sort()).toEqual(['1', '2']);
    });

    it('returns empty array when no entities', () => {
      expect(store.getState().getAll()).toEqual([]);
    });
  });

  describe('getById', () => {
    it('returns entity when found', () => {
      store.getState().setOne({ id: '1', name: 'one', value: 1 });

      expect(store.getState().getById('1')).toEqual({
        id: '1',
        name: 'one',
        value: 1,
      });
    });

    it('returns undefined when not found', () => {
      expect(store.getState().getById('nonexistent')).toBeUndefined();
    });
  });
});
