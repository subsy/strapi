'use strict';

const _ = require('lodash');
const { createLockService } = require('../lock');

const v4Regex = /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i;

describe('Lock service', () => {
  describe('set', () => {
    test.each([false, true])('no existing lock (force: %p)', async force => {
      const create = jest.fn(lock => Promise.resolve(lock));
      const findOne = jest.fn(() => Promise.resolve(null));
      const db = {
        query: () => ({
          create,
          findOne,
        }),
      };

      const lock = {
        key: 'edit:article:1',
        ttl: 30000,
        metadata: { info: true },
      };

      const lockService = createLockService({ db })({ prefix: 'pluginName' });
      const lockResult = await lockService.set(lock, { force });

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          uid: expect.stringMatching(v4Regex),
          key: `pluginName::${lock.key}`,
          metadata: JSON.stringify(lock.metadata),
          expiresAt: expect.anything(),
        })
      );
      expect(lockResult).toBeDefined();
      expect(lockResult.success).toBe(true);
      expect(lockResult.lock).toMatchObject({
        key: lock.key,
        metadata: lock.metadata,
        uid: expect.stringMatching(v4Regex),
        expiresAt: expect.anything(),
      });
    });

    test.each([false, true])('lock exists and has expired (force: %p)', async force => {
      const existingLock = {
        uid: '128b0285-9dc2-4335-a6a0-285b1a3fac77',
        key: 'pluginName::edit:article:1',
        metadata: '{"info":true}',
        expiresAt: 940682173000, // october 23th 1999 14:36:13 GMT+02:00
      };

      const create = jest.fn(lock => Promise.resolve(lock));
      const findOne = jest.fn(() => Promise.resolve(existingLock));
      const deleteFn = jest.fn(() => Promise.resolve([existingLock]));
      const db = {
        query: () => ({
          create,
          findOne,
          delete: deleteFn,
        }),
      };

      const lock = {
        key: 'edit:article:1',
        ttl: 30000,
        metadata: { info: true },
      };

      const lockService = createLockService({ db })({ prefix: 'pluginName' });
      const lockResult = await lockService.set(lock, { force });

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          uid: expect.stringMatching(v4Regex),
          key: `pluginName::${lock.key}`,
          metadata: JSON.stringify(lock.metadata),
          expiresAt: expect.anything(),
        })
      );
      expect(deleteFn).toHaveBeenCalledWith(_.pick(existingLock, ['uid', 'key']));
      expect(lockResult).toBeDefined();
      expect(lockResult.success).toBe(true);
      expect(lockResult.lock).toMatchObject({
        key: lock.key,
        metadata: lock.metadata,
        uid: expect.stringMatching(v4Regex),
        expiresAt: expect.anything(),
      });
    });

    test.each([null, 64086208573000])(
      'lock exists and has not expired (force: false) (expiresAt: %p)',
      async expiresAt => {
        const existingLock = {
          uid: '128b0285-9dc2-4335-a6a0-285b1a3fac77',
          key: 'pluginName::edit:article:1',
          metadata: 'null',
          expiresAt,
        };

        const create = jest.fn(lock => Promise.resolve(lock));
        const findOne = jest.fn(() => Promise.resolve(existingLock));
        const deleteFn = jest.fn(() => Promise.resolve([existingLock]));
        const db = {
          query: () => ({
            create,
            findOne,
            delete: deleteFn,
          }),
        };

        const lock = {
          key: 'edit:article:1',
          ttl: 30000,
          metadata: { info: true },
        };

        const lockService = createLockService({ db })({ prefix: 'pluginName' });
        const lockResult = await lockService.set(lock, { force: false });

        expect(create).toHaveBeenCalledTimes(0);
        expect(deleteFn).toHaveBeenCalledTimes(0);
        expect(lockResult).toBeDefined();
        expect(lockResult.success).toBe(false);
        expect(lockResult.lock).toMatchObject({
          uid: existingLock.uid,
          key: lock.key,
          expiresAt: existingLock.expiresAt,
          metadata: JSON.parse(existingLock.metadata),
        });
      }
    );

    test.each([null, 64086208573000])(
      'lock exists and has not expired (force: true) (expiresAt: %p)',
      async expiresAt => {
        const existingLock = {
          uid: '128b0285-9dc2-4335-a6a0-285b1a3fac77',
          key: 'pluginName::edit:article:1',
          metadata: 'null',
          expiresAt,
        };

        const create = jest.fn(lock => Promise.resolve(lock));
        const findOne = jest.fn(() => Promise.resolve(existingLock));
        const deleteFn = jest.fn(() => Promise.resolve([existingLock]));
        const db = {
          query: () => ({
            create,
            findOne,
            delete: deleteFn,
          }),
        };

        const lock = {
          key: 'edit:article:1',
          ttl: 30000,
          metadata: { info: true },
        };

        const lockService = createLockService({ db })({ prefix: 'pluginName' });
        const lockResult = await lockService.set(lock, { force: true });

        expect(create).toHaveBeenCalledWith(
          expect.objectContaining({
            uid: expect.stringMatching(v4Regex),
            key: `pluginName::${lock.key}`,
            metadata: JSON.stringify(lock.metadata),
            expiresAt: expect.anything(),
          })
        );
        expect(deleteFn).toHaveBeenCalledWith(_.pick(existingLock, ['uid', 'key']));
        expect(lockResult).toBeDefined();
        expect(lockResult.success).toBe(true);
        expect(lockResult.lock).toMatchObject({
          key: lock.key,
          metadata: lock.metadata,
          uid: expect.stringMatching(v4Regex),
          expiresAt: expect.anything(),
        });
        expect(lockResult.lock.uid).not.toBe(existingLock.uid);
      }
    );
  });

  describe('get', () => {
    test.each([1, null, 64086208573000])(
      'lock exists and has expired (expiresAt: %p)',
      async expiresAt => {
        const existingLock = {
          uid: '128b0285-9dc2-4335-a6a0-285b1a3fac77',
          key: 'pluginName::edit:article:1',
          expiresAt,
          metadata: '{"info":true}',
        };

        const findOne = jest.fn(() => Promise.resolve(existingLock));
        const db = {
          query: () => ({ findOne }),
        };

        const lockService = createLockService({ db })({ prefix: 'pluginName' });
        const lockResult = await lockService.get('edit:article:1');

        expect(findOne).toHaveBeenCalledWith({ key: existingLock.key });
        expect(lockResult).toBeDefined();
        expect(lockResult.isLockFree).toBe(expiresAt === 1 ? true : false);
        expect(lockResult.lock).toMatchObject({
          ...existingLock,
          key: 'edit:article:1',
          metadata: JSON.parse(existingLock.metadata),
        });
      }
    );
    test('lock does not exist)', async () => {
      const findOne = jest.fn(() => Promise.resolve(null));
      const db = {
        query: () => ({ findOne }),
      };

      const lockService = createLockService({ db })({ prefix: 'pluginName' });
      const lockResult = await lockService.get('invalid-key');

      expect(findOne).toHaveBeenCalledWith({ key: 'pluginName::invalid-key' });
      expect(lockResult).toBeDefined();
      expect(lockResult.isLockFree).toBe(true);
      expect(lockResult.lock).toBeNull();
    });
  });

  describe('delete', () => {
    test('lock exists (uid: valid, key: valid)', async () => {
      const existingLock = {
        uid: '128b0285-9dc2-4335-a6a0-285b1a3fac77',
        key: 'pluginName::edit:article:1',
        expiresAt: 1234,
        metadata: '{"info":true}',
      };

      const findOne = jest.fn(() => Promise.resolve(existingLock));
      const deleteFn = jest.fn(() => Promise.resolve([existingLock]));
      const db = {
        query: () => ({ findOne, delete: deleteFn }),
      };

      const lockService = createLockService({ db })({ prefix: 'pluginName' });
      const lockResult = await lockService.delete('edit:article:1', existingLock.uid);

      expect(deleteFn).toHaveBeenCalledWith(_.pick(existingLock, ['uid', 'key']));
      expect(lockResult).toBeDefined();
      expect(lockResult.lock).toMatchObject({
        ...existingLock,
        key: 'edit:article:1',
        metadata: JSON.parse(existingLock.metadata),
      });
    });
    test('lock does not exist (uid: invalid, key: valid)', async () => {
      const existingLock = {
        uid: '128b0285-9dc2-4335-a6a0-285b1a3fac77',
        key: 'pluginName::edit:article:1',
        expiresAt: 1234,
        metadata: '{"info":true}',
      };

      const findOne = jest.fn(() => Promise.resolve(existingLock));
      const deleteFn = jest.fn(() => Promise.resolve([null]));
      const db = {
        query: () => ({ findOne, delete: deleteFn }),
      };

      const lockService = createLockService({ db })({ prefix: 'pluginName' });
      const lockResult = await lockService.delete('edit:article:1', 'invalid-uid');

      expect(deleteFn).toHaveBeenCalledWith({ key: existingLock.key, uid: 'invalid-uid' });
      expect(lockResult).toBeDefined();
      expect(lockResult.lock).toBeNull();
    });
    test('lock does not exist (uid: valid, key: invalid)', async () => {
      const existingLock = {
        uid: '128b0285-9dc2-4335-a6a0-285b1a3fac77',
        key: 'pluginName::edit:article:1',
        expiresAt: 1234,
        metadata: '{"info":true}',
      };

      const findOne = jest.fn(() => Promise.resolve(existingLock));
      const deleteFn = jest.fn(() => Promise.resolve([null]));
      const db = {
        query: () => ({ findOne, delete: deleteFn }),
      };

      const lockService = createLockService({ db })({ prefix: 'pluginName' });
      const lockResult = await lockService.delete('invalid-key', existingLock.uid);

      expect(deleteFn).toHaveBeenCalledWith({
        key: 'pluginName::invalid-key',
        uid: existingLock.uid,
      });
      expect(lockResult).toBeDefined();
      expect(lockResult.lock).toBeNull();
    });
  });
});
