'use strict';

const _ = require('lodash');
const { ACTIONS } = require('../services/constants');
const { validateLockInput, validateExtendLockInput } = require('./validation');

const sanitizeLock = (lock, { withUid = false } = {}) => {
  if (_.isNil(lock)) {
    return null;
  }

  const omittedAttributes = ['key', 'id'];
  if (!withUid) {
    omittedAttributes.push('uid');
  }

  return _.omit(lock, omittedAttributes);
};

const getLock = async ctx => {
  const {
    state: { userAbility },
    params: { id, model },
  } = ctx;

  const { kind } = strapi.getModel(model);

  const contentManagerService = strapi.plugins['content-manager'].services.contentmanager;
  try {
    await contentManagerService.findEntityAndCheckPermissions(userAbility, ACTIONS.edit, model, id);
  } catch (e) {
    if (e.message !== 'Not Found' || kind !== 'singleType') {
      throw e;
    }
  }

  const editingLockService = strapi.plugins['content-manager'].services.editinglock;
  const lockResult = await editingLockService.getLock({ model, entityId: id });

  return {
    isLockFree: lockResult.isLockFree,
    lockInfo: sanitizeLock(lockResult.lock),
  };
};

const lock = async ctx => {
  const {
    state: { userAbility, user },
    params: { id, model },
    request: { body },
  } = ctx;

  try {
    await validateLockInput(body);
  } catch (err) {
    return ctx.badRequest('ValidationError', err);
  }

  const metadata = _.get(body, 'metadata', {});
  const force = _.get(body, 'force', false) === true;
  const { kind } = strapi.getModel(model);

  const contentManagerService = strapi.plugins['content-manager'].services.contentmanager;
  try {
    await contentManagerService.findEntityAndCheckPermissions(userAbility, ACTIONS.edit, model, id);
  } catch (e) {
    if (e.message !== 'Not Found' || kind !== 'singleType') {
      throw e;
    }
  }

  const editingLockService = strapi.plugins['content-manager'].services.editinglock;
  const lockResult = await editingLockService.setLock(
    { model, entityId: id, metadata, user },
    { force }
  );

  return {
    success: lockResult.success,
    lockInfo: sanitizeLock(lockResult.lock, { withUid: true }),
  };
};

const extendLock = async ctx => {
  const {
    state: { userAbility },
    params: { id, model },
    request: { body },
  } = ctx;

  try {
    await validateExtendLockInput(body);
  } catch (err) {
    return ctx.badRequest('ValidationError', err);
  }

  const metadata = _.get(body, 'metadata', undefined);
  const { kind } = strapi.getModel(model);

  const contentManagerService = strapi.plugins['content-manager'].services.contentmanager;
  try {
    await contentManagerService.findEntityAndCheckPermissions(userAbility, ACTIONS.edit, model, id);
  } catch (e) {
    if (e.message !== 'Not Found' || kind !== 'singleType') {
      throw e;
    }
  }

  const editingLockService = strapi.plugins['content-manager'].services.editinglock;
  const lockResult = await editingLockService.extendLock({
    model,
    entityId: id,
    metadata,
    uid: body.uid,
  });

  return {
    success: lockResult.success,
    lockInfo: sanitizeLock(lockResult.lock, { withUid: true }),
  };
};

const unlock = async ctx => {
  const {
    state: { userAbility },
    params: { id, model },
    request: { body },
  } = ctx;

  try {
    await validateExtendLockInput(body);
  } catch (err) {
    return ctx.badRequest('ValidationError', err);
  }

  const { kind } = strapi.getModel(model);

  const contentManagerService = strapi.plugins['content-manager'].services.contentmanager;
  try {
    await contentManagerService.findEntityAndCheckPermissions(userAbility, ACTIONS.edit, model, id);
  } catch (e) {
    if (e.message !== 'Not Found' || kind !== 'singleType') {
      throw e;
    }
  }

  const editingLockService = strapi.plugins['content-manager'].services.editinglock;
  const lockResult = await editingLockService.unlock({ model, entityId: id, uid: body.uid });

  return {
    success: lockResult.success,
    lockInfo: sanitizeLock(lockResult.lock),
  };
};

module.exports = {
  lock,
  extendLock,
  unlock,
  getLock,
};
