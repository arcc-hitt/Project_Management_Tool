import { ObjectId } from 'mongodb';

export const toObjectId = (value: unknown): ObjectId | null => {
  if (!value) return null;
  if (value instanceof ObjectId) return value;
  const normalized = String(value);
  return ObjectId.isValid(normalized) ? new ObjectId(normalized) : null;
};

export const normalizeId = (value: unknown): string | null => {
  if (!value) return null;
  return value instanceof ObjectId ? value.toHexString() : String(value);
};

export const mapDoc = <T extends Record<string, any>>(doc: T | null): (T & { id: string | null }) | null => {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return {
    ...(rest as T),
    id: normalizeId(_id),
  };
};

export const withTimestampsOnCreate = (payload: Record<string, any> = {}) => {
  const now = new Date();
  return {
    ...payload,
    createdAt: payload.createdAt || now,
    updatedAt: payload.updatedAt || now,
  };
};

export const withUpdatedAt = (payload: Record<string, any> = {}) => ({
  ...payload,
  updatedAt: new Date(),
});

export { ObjectId };
