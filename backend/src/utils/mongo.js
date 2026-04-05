import { ObjectId } from 'mongodb';

export const toObjectId = (value) => {
  if (!value) return null;
  if (value instanceof ObjectId) return value;
  if (typeof value !== 'string') {
    value = String(value);
  }
  return ObjectId.isValid(value) ? new ObjectId(value) : null;
};

export const normalizeId = (value) => {
  if (!value) return null;
  return value instanceof ObjectId ? value.toHexString() : String(value);
};

export const mapDoc = (doc) => {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return {
    id: normalizeId(_id),
    ...rest,
  };
};

export const withTimestampsOnCreate = (payload = {}) => {
  const now = new Date();
  return {
    ...payload,
    createdAt: payload.createdAt || now,
    updatedAt: payload.updatedAt || now,
  };
};

export const withUpdatedAt = (payload = {}) => ({
  ...payload,
  updatedAt: new Date(),
});

export { ObjectId };
