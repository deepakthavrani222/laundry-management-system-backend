const mongoose = require('mongoose');

const billingPlanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    enum: ['free', 'basic', 'pro', 'enterprise']
  },
  displayName: {
    type: String,
    required: true
  },
  price: {
    monthly: { type: Number, default: 0 },
    yearly: { type: Number, default: 0 }
  },
  features: {
    maxOrders: { type: Number, default: 100 },
    maxStaff: { type: Number, default: 5 },
    maxCustomers: { type: Number, default: 500 },
    maxBranches: { type: Number, default: 1 },
    customDomain: { type: Boolean, default: false },
    advancedAnalytics: { type: Boolean, default: false },
    apiAccess: { type: Boolean, default: false },
    whiteLabel: { type: Boolean, default: false },
    prioritySupport: { type: Boolean, default: false },
    customBranding: { type: Boolean, default: true }
  },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const invoiceSchema = new mongoose.Schema({
  tenancy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenancy',
    required: true,
    index: true
  },
  invoiceNumber: {
    type: String,
    unique: true,
    sparse: true
  },
  billingPeriod: {
    start: { type: Date, required: true },
    end: { type: Date, required: true }
  },
  plan: {
    type: String,
    enum: ['free', 'basic', 'pro', 'enterprise'],
    required: true
  },
  billingCycle: {
    type: String,
    enum: ['monthly', 'yearly'],
    default: 'monthly'
  },
  amount: {
    subtotal: { type: Number, required: true },
    tax: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    total: { type: Number, required: true }
  },
  status: {
    type: String,
    enum: ['draft', 'pending', 'paid', 'overdue', 'cancelled', 'refunded'],
    default: 'pending'
  },
  dueDate: { type: Date, required: true },
  paidAt: { type: Date },
  paymentMethod: {
    type: String,
    enum: ['card', 'bank_transfer', 'upi', 'wallet', 'manual']
  },
  paymentDetails: {
    transactionId: String,
    gateway: String,
    gatewayResponse: mongoose.Schema.Types.Mixed
  },
  notes: String
}, { timestamps: true });

// Generate invoice number
invoiceSchema.pre('save', async function(next) {
  if (!this.invoiceNumber) {
    const count = await mongoose.model('TenancyInvoice').countDocuments();
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    this.invoiceNumber = `INV-${year}${month}-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

const paymentSchema = new mongoose.Schema({
  tenancy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenancy',
    required: true,
    index: true
  },
  invoice: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TenancyInvoice'
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'INR'
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'bank_transfer', 'upi', 'wallet', 'manual'],
    required: true
  },
  transactionId: String,
  gateway: String,
  gatewayResponse: mongoose.Schema.Types.Mixed,
  refundedAmount: { type: Number, default: 0 },
  refundedAt: Date,
  notes: String
}, { timestamps: true });

// Indexes
invoiceSchema.index({ tenancy: 1, createdAt: -1 });
invoiceSchema.index({ status: 1, dueDate: 1 });
paymentSchema.index({ tenancy: 1, createdAt: -1 });
paymentSchema.index({ status: 1 });

const BillingPlan = mongoose.model('BillingPlan', billingPlanSchema);
const TenancyInvoice = mongoose.model('TenancyInvoice', invoiceSchema);
const TenancyPayment = mongoose.model('TenancyPayment', paymentSchema);

module.exports = {
  BillingPlan,
  TenancyInvoice,
  TenancyPayment
};
