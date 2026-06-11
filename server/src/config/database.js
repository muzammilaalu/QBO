import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }
};

// ── Cache TTL: 24 hours ──
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// ── Payment Cache Schema ──
const paymentCacheSchema = new mongoose.Schema({
  id:         { type: String, required: true },
  realmId:    { type: String, required: true },
  data:       { type: mongoose.Schema.Types.Mixed, required: true },
  fetchedAt:  { type: Date, default: Date.now },
}, { timestamps: false });

paymentCacheSchema.index({ id: 1, realmId: 1 }, { unique: true });
paymentCacheSchema.index({ fetchedAt: 1 }, { expireAfterSeconds: 86400 }); // Auto delete after 24h

// ── BillPayment Cache Schema ──
const billPaymentCacheSchema = new mongoose.Schema({
  id:         { type: String, required: true },
  realmId:    { type: String, required: true },
  data:       { type: mongoose.Schema.Types.Mixed, required: true },
  fetchedAt:  { type: Date, default: Date.now },
}, { timestamps: false });

billPaymentCacheSchema.index({ id: 1, realmId: 1 }, { unique: true });
billPaymentCacheSchema.index({ fetchedAt: 1 }, { expireAfterSeconds: 86400 });

// ── Entity Cache Schema (CreditMemo, Invoice, JE etc.) ──
const entityCacheSchema = new mongoose.Schema({
  cacheKey:   { type: String, required: true },
  realmId:    { type: String, required: true },
  data:       { type: mongoose.Schema.Types.Mixed, required: true },
  fetchedAt:  { type: Date, default: Date.now },
}, { timestamps: false });

entityCacheSchema.index({ cacheKey: 1, realmId: 1 }, { unique: true });
entityCacheSchema.index({ fetchedAt: 1 }, { expireAfterSeconds: 86400 });

// ── Models ──
export const PaymentCache     = mongoose.model('PaymentCache',     paymentCacheSchema);
export const BillPaymentCache = mongoose.model('BillPaymentCache', billPaymentCacheSchema);
export const EntityCache      = mongoose.model('EntityCache',      entityCacheSchema);

// ── Helper Functions ──

// Payment cache
export const getPaymentsFromCache = async (realmId) => {
  const cutoff = new Date(Date.now() - CACHE_TTL_MS);
  const docs = await PaymentCache.find({
    realmId,
    fetchedAt: { $gt: cutoff },
  }).lean();
  return docs.map(d => d.data);
};

export const savePaymentsToCache = async (realmId, payments) => {
  const ops = payments.map(p => ({
    updateOne: {
      filter: { id: p.Id, realmId },
      update: { $set: { data: p, fetchedAt: new Date() } },
      upsert: true,
    },
  }));
  await PaymentCache.bulkWrite(ops);
  console.log(`💾 ${payments.length} payments cached in MongoDB`);
};

// BillPayment cache
export const getBillPaymentsFromCache = async (realmId) => {
  const cutoff = new Date(Date.now() - CACHE_TTL_MS);
  const docs = await BillPaymentCache.find({
    realmId,
    fetchedAt: { $gt: cutoff },
  }).lean();
  return docs.map(d => d.data);
};

export const saveBillPaymentsToCache = async (realmId, billPayments) => {
  const ops = billPayments.map(bp => ({
    updateOne: {
      filter: { id: bp.Id, realmId },
      update: { $set: { data: bp, fetchedAt: new Date() } },
      upsert: true,
    },
  }));
  await BillPaymentCache.bulkWrite(ops);
  console.log(`💾 ${billPayments.length} bill payments cached in MongoDB`);
};

// Entity cache
export const getEntityFromCache = async (cacheKey, realmId) => {
  const cutoff = new Date(Date.now() - CACHE_TTL_MS);
  const doc = await EntityCache.findOne({
    cacheKey,
    realmId,
    fetchedAt: { $gt: cutoff },
  }).lean();
  return doc ? doc.data : null;
};

export const saveEntityToCache = async (cacheKey, realmId, data) => {
  await EntityCache.updateOne(
    { cacheKey, realmId },
    { $set: { data, fetchedAt: new Date() } },
    { upsert: true }
  );
};

// Cache clear (logout pe)
export const clearCacheForRealm = async (realmId) => {
  await Promise.all([
    PaymentCache.deleteMany({ realmId }),
    BillPaymentCache.deleteMany({ realmId }),
    EntityCache.deleteMany({ realmId }),
  ]);
  console.log(`🗑️ Cache cleared for realm: ${realmId}`);
};

export default connectDB;