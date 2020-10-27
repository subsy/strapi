'use strict';

const { registerAndLogin } = require('../../../test/helpers/auth');
const createModelsUtils = require('../../../test/helpers/models');
const { createAuthRequest } = require('../../../test/helpers/request');

let rq;
let modelsUtils;
let data = {
  products: [],
  locks: [],
};
const baseUrl = '/content-manager/collection-type/application::product.product';

const getExpiresAtTime = lock => new Date(lock.expiresAt).getTime();
const getLastUpdatedAtTime = lock => new Date(lock.metadata.lastUpdatedAt).getTime();

const productModel = {
  attributes: {
    name: {
      type: 'string',
      required: true,
    },
    description: {
      type: 'text',
      minLength: 4,
      maxLength: 30,
    },
  },
  draftAndPublish: true,
  connection: 'default',
  name: 'product',
  description: '',
  collectionName: '',
};

describe('Editing Lock', () => {
  beforeAll(async () => {
    const token = await registerAndLogin();
    rq = createAuthRequest(token);

    modelsUtils = createModelsUtils({ rq });
    await modelsUtils.createContentTypes([productModel]);

    const product = {
      name: 'Product 1',
      description: 'Product description',
    };
    const res = await rq({
      method: 'POST',
      url: '/content-manager/explorer/application::product.product',
      body: product,
    });
    data.products.push(res.body);
  }, 60000);

  afterAll(async () => {
    await modelsUtils.deleteContentTypes(['product']);
  }, 60000);

  test('Lock product 1', async () => {
    const res = await rq({
      method: 'POST',
      url: `${baseUrl}/${data.products[0].id}/actions/lock`,
    });

    expect(res.body).toMatchObject({
      success: true,
      lockInfo: expect.objectContaining({
        uid: expect.any(String),
        metadata: {
          lastUpdatedAt: expect.any(String),
          lockedBy: {
            id: expect.anything(),
            firstname: 'admin',
            lastname: 'admin',
            username: null,
          },
        },
        expiresAt: expect.any(String),
      }),
    });
    data.locks.push(res.body.lockInfo);
  });

  test('Get lock info for product 1 (has not expired yet)', async () => {
    const res = await rq({
      method: 'GET',
      url: `${baseUrl}/${data.products[0].id}/actions/lock`,
    });

    expect(res.body).toMatchObject({
      lockInfo: expect.objectContaining({
        metadata: data.locks[0].metadata,
        expiresAt: data.locks[0].expiresAt,
      }),
    });
  });

  test('Cannot lock product 1 (force: false)', async () => {
    const res = await rq({
      method: 'POST',
      url: `${baseUrl}/${data.products[0].id}/actions/lock`,
    });

    expect(res.body).toMatchObject({
      success: false,
      lockInfo: expect.objectContaining({
        metadata: data.locks[0].metadata,
        expiresAt: data.locks[0].expiresAt,
      }),
    });
  });

  test('Can lock product 1 (force: true)', async () => {
    const res = await rq({
      method: 'POST',
      url: `${baseUrl}/${data.products[0].id}/actions/lock`,
      body: { force: true },
    });

    expect(res.body).toMatchObject({
      success: true,
      lockInfo: expect.objectContaining({
        uid: expect.any(String),
        metadata: {
          ...data.locks[0].metadata,
          lastUpdatedAt: expect.any(String),
        },
        expiresAt: expect.any(String),
      }),
    });
    data.locks[0] = res.body.lockInfo;
  });

  test('lastUpdatedAt is updated when editing the entry', async () => {
    const product = {
      name: 'Product 1 updated',
      description: 'Updated Product description',
    };
    await rq({
      method: 'PUT',
      url: `/content-manager/explorer/application::product.product/${data.products[0].id}`,
      body: product,
    });

    const { body } = await rq({
      method: 'GET',
      url: `${baseUrl}/${data.products[0].id}/actions/lock`,
    });

    expect(getLastUpdatedAtTime(body.lockInfo) > getLastUpdatedAtTime(data.locks[0])).toBe(true);
    data.locks[0].metadata.lastUpdatedAt = body.lockInfo.metadata.lastUpdatedAt;
  });

  test.each(['publish', 'unpublish'])(
    'lastUpdatedAt is updated when %ping the entry',
    async action => {
      await rq({
        method: 'POST',
        url: `/content-manager/explorer/application::product.product/${action}/${data.products[0].id}`,
      });

      const { body } = await rq({
        method: 'GET',
        url: `${baseUrl}/${data.products[0].id}/actions/lock`,
      });

      expect(getLastUpdatedAtTime(body.lockInfo) > getLastUpdatedAtTime(data.locks[0])).toBe(true);
      data.locks[0].metadata.lastUpdatedAt = body.lockInfo.metadata.lastUpdatedAt;
    }
  );

  test('Can extend product 1', async () => {
    const res = await rq({
      method: 'POST',
      url: `${baseUrl}/${data.products[0].id}/actions/extend-lock`,
      body: { uid: data.locks[0].uid },
    });

    expect(res.body).toMatchObject({
      success: true,
      lockInfo: expect.objectContaining({
        uid: expect.any(String),
        metadata: data.locks[0].metadata,
        expiresAt: expect.any(String),
      }),
    });
    expect(getExpiresAtTime(res.body.lockInfo) > getExpiresAtTime(data.locks[0])).toBe(true);
    data.locks[0] = res.body.lockInfo;
  });

  test('Cannot extend product 1 (wrong uid)', async () => {
    const res = await rq({
      method: 'POST',
      url: `${baseUrl}/${data.products[0].id}/actions/extend-lock`,
      body: { uid: 'bad-uid' },
    });

    expect(res.body).toMatchObject({
      success: false,
      lockInfo: expect.objectContaining({
        metadata: data.locks[0].metadata,
        expiresAt: data.locks[0].expiresAt,
      }),
    });
  });

  test('Unlock product 1', async () => {
    const res = await rq({
      method: 'POST',
      url: `${baseUrl}/${data.products[0].id}/actions/unlock`,
      body: {
        uid: data.locks[0].uid,
      },
    });

    expect(res.body).toMatchObject({
      success: true,
      lockInfo: expect.objectContaining({
        metadata: data.locks[0].metadata,
        expiresAt: expect.any(String),
      }),
    });
    expect(getExpiresAtTime(res.body.lockInfo) < Date.now()).toBe(true);
    data.locks[0].expiresAt = res.body.lockInfo.expiresAt;
  });

  test('Get lock info for product 1 (has expired)', async () => {
    const res = await rq({
      method: 'GET',
      url: `${baseUrl}/${data.products[0].id}/actions/lock`,
    });

    expect(res.body).toMatchObject({
      lockInfo: expect.objectContaining({
        metadata: data.locks[0].metadata,
        expiresAt: data.locks[0].expiresAt,
      }),
    });
  });

  test('Cannot unlock product 1 if already expired', async () => {
    const res = await rq({
      method: 'POST',
      url: `${baseUrl}/${data.products[0].id}/actions/unlock`,
      body: {
        uid: data.locks[0].uid,
      },
    });

    expect(res.body).toMatchObject({
      success: false,
      lockInfo: expect.objectContaining({
        metadata: data.locks[0].metadata,
        expiresAt: data.locks[0].expiresAt,
      }),
    });
  });
});
