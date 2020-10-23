'use strict';

const _ = require('lodash');
const uuid = require('uuid/v4');

const toDBObject = ({ key, metadata, ttl }, { now }) => {
  let stringifiedMetadata;
  try {
    stringifiedMetadata = JSON.stringify(metadata);
  } catch {
    throw new Error('lockservice: metadata param could not be stringified');
  }

  return {
    uid: uuid(),
    key,
    metadata: stringifiedMetadata,
    expiresAt: now + ttl,
  };
};

const fromDBObject = (lock, prefix) => {
  if (!_.isPlainObject(lock)) {
    return null;
  }

  return {
    ...lock,
    key: lock.key.replace(new RegExp(`^${prefix}::`), ''),
    metadata: JSON.parse(lock.metadata),
  };
};

const isLockFree = (lock, now) => {
  return !lock || (lock.expiresAt !== null && new Date(lock.expiresAt).getTime() <= now);
};

const createLockService = ({ db }) => ({ prefix }) => {
  if (!_.isString(prefix) || _.isEmpty(prefix)) {
    throw new Error('lockservice: prefix param has to be a non-empty string');
  }
  const lockQueries = db.query('strapi_locks');
  const getPrefixedKey = key => `${prefix}::${key}`;

  return {
    async delete(key, uid) {
      if (!_.isString(uid) || _.isNil(uid)) {
        throw new Error('lockservice: uid param has to be a non-empty string');
      }

      const prefixedKey = getPrefixedKey(key);
      const lock = await lockQueries.delete({ key: prefixedKey, uid });
      return { lock: fromDBObject(lock, prefix) };
    },

    async get(key) {
      const prefixedKey = getPrefixedKey(key);
      const existingLock = await lockQueries.findOne({ key: prefixedKey });
      return {
        isLockFree: isLockFree(existingLock, Date.now()),
        lock: fromDBObject(existingLock, prefix),
      };
    },

    async set({ key, metadata = null, ttl = null } = {}, { force = false } = {}) {
      if (!_.isString(key) || _.isEmpty(key)) {
        throw new Error('lockservice: key param has to be a non-empty string');
      }
      if (!_.isInteger(ttl) && !_.isNull(key)) {
        throw new Error('lockservice: ttl param has to be null or to be a integer');
      }

      const prefixedKey = getPrefixedKey(key);
      let lock;
      const now = Date.now();
      const newLock = toDBObject({ key: prefixedKey, metadata, ttl }, { now });
      const { isLockFree: isExistingLockFree, lock: existingLock } = await this.get(key);

      // lock doesn't exist in DB, so just need to create it
      if (!existingLock) {
        lock = await lockQueries.create(newLock);
        return { success: true, lock: fromDBObject(lock, prefix) };
      }

      // lock exist and has expired or lock exist but we force the take
      // need to delete the existing one and create the new one
      if (isExistingLockFree || (existingLock && force)) {
        const { lock: deletedLock } = await this.delete(existingLock.key, existingLock.uid);
        if (!deletedLock) {
          return { success: false, lock: null };
        } else {
          lock = await lockQueries.create(newLock);
          return { success: true, lock: fromDBObject(lock, prefix) };
        }
      }

      // lock exists in DB and is valid
      if (!isExistingLockFree && !force) {
        return { success: false, lock: existingLock };
      }

      return { success: false, lock: null }; // should never be reached
    },
  };
};

module.exports = createLockService;
