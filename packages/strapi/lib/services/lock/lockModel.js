const lockModel = config => ({
  connection: config.get('database.defaultConnection'),
  uid: 'strapi::locks',
  internal: true,
  globalId: 'StrapiLocks',
  collectionName: 'strapi_locks',
  info: {
    name: 'Strapi locks',
    description: '',
  },
  options: {
    timestamps: true,
  },
  attributes: {
    uid: {
      type: 'string',
      required: true,
      unique: true,
      index: true,
    },
    key: {
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    metadata: {
      type: 'string',
      required: true,
    },
    expiresAt: {
      type: 'datetime',
    },
  },
});

module.exports = lockModel;
