const Tenancy = require('../../models/Tenancy');
const Order = require('../../models/Order');
const User = require('../../models/User');
const { TenancyPayment } = require('../../models/TenancyBilling');

const tenancyAnalyticsController = {
  // Get analytics for a specific tenancy
  getTenancyAnalytics: async (req, res) => {
    try {
      const { tenancyId } = req.params;
      const { period = '30d' } = req.query;
      
      const tenancy = await Tenancy.findById(tenancyId);
      if (!tenancy) {
        return res.status(404).json({ success: false, message: 'Tenancy not found' });
      }
      
      // Calculate date range
      const now = new Date();
      let startDate = new Date();
      switch (period) {
        case '7d': startDate.setDate(now.getDate() - 7); break;
        case '30d': startDate.setDate(now.getDate() - 30); break;
        case '90d': startDate.setDate(now.getDate() - 90); break;
        case '1y': startDate.setFullYear(now.getFullYear() - 1); break;
        default: startDate.setDate(now.getDate() - 30);
      }
      
      const [
        totalOrders,
        periodOrders,
        totalRevenue,
        periodRevenue,
        totalCustomers,
        newCustomers,
        ordersByStatus,
        dailyOrders,
        topServices
      ] = await Promise.all([
        Order.countDocuments({ tenancy: tenancyId }),
        Order.countDocuments({ tenancy: tenancyId, createdAt: { $gte: startDate } }),
        Order.aggregate([
          { $match: { tenancy: tenancy._id } },
          { $group: { _id: null, total: { $sum: '$pricing.total' } } }
        ]),
        Order.aggregate([
          { $match: { tenancy: tenancy._id, createdAt: { $gte: startDate } } },
          { $group: { _id: null, total: { $sum: '$pricing.total' } } }
        ]),
        User.countDocuments({ tenancy: tenancyId, role: 'customer' }),
        User.countDocuments({ tenancy: tenancyId, role: 'customer', createdAt: { $gte: startDate } }),
        Order.aggregate([
          { $match: { tenancy: tenancy._id, createdAt: { $gte: startDate } } },
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ]),
        Order.aggregate([
          { $match: { tenancy: tenancy._id, createdAt: { $gte: startDate } } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              orders: { $sum: 1 },
              revenue: { $sum: '$pricing.total' }
            }
          },
          { $sort: { _id: 1 } }
        ]),
        Order.aggregate([
          { $match: { tenancy: tenancy._id, createdAt: { $gte: startDate } } },
          { $unwind: '$items' },
          { $lookup: { from: 'orderitems', localField: 'items', foreignField: '_id', as: 'itemDetails' } },
          { $unwind: '$itemDetails' },
          {
            $group: {
              _id: '$itemDetails.serviceName',
              count: { $sum: '$itemDetails.quantity' },
              revenue: { $sum: '$itemDetails.totalPrice' }
            }
          },
          { $sort: { revenue: -1 } },
          { $limit: 10 }
        ])
      ]);
      
      res.json({
        success: true,
        data: {
          tenancy: {
            name: tenancy.name,
            subdomain: tenancy.subdomain,
            plan: tenancy.subscription.plan,
            status: tenancy.status
          },
          overview: {
            totalOrders,
            periodOrders,
            totalRevenue: totalRevenue[0]?.total || 0,
            periodRevenue: periodRevenue[0]?.total || 0,
            totalCustomers,
            newCustomers,
            avgOrderValue: periodOrders > 0 ? (periodRevenue[0]?.total || 0) / periodOrders : 0
          },
          ordersByStatus: ordersByStatus.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, {}),
          dailyOrders,
          topServices
        }
      });
    } catch (error) {
      console.error('Get tenancy analytics error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch analytics' });
    }
  },

  // Get platform-wide tenancy analytics
  getPlatformAnalytics: async (req, res) => {
    try {
      const { period = '30d' } = req.query;
      
      const now = new Date();
      let startDate = new Date();
      switch (period) {
        case '7d': startDate.setDate(now.getDate() - 7); break;
        case '30d': startDate.setDate(now.getDate() - 30); break;
        case '90d': startDate.setDate(now.getDate() - 90); break;
        case '1y': startDate.setFullYear(now.getFullYear() - 1); break;
        default: startDate.setDate(now.getDate() - 30);
      }
      
      const [
        totalTenancies,
        activeTenancies,
        newTenancies,
        tenanciesByPlan,
        tenanciesByStatus,
        topTenanciesByOrders,
        topTenanciesByRevenue,
        platformRevenue,
        dailySignups
      ] = await Promise.all([
        Tenancy.countDocuments(),
        Tenancy.countDocuments({ status: 'active' }),
        Tenancy.countDocuments({ createdAt: { $gte: startDate } }),
        Tenancy.aggregate([
          { $group: { _id: '$subscription.plan', count: { $sum: 1 } } }
        ]),
        Tenancy.aggregate([
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ]),
        Order.aggregate([
          { $match: { createdAt: { $gte: startDate } } },
          { $group: { _id: '$tenancy', orderCount: { $sum: 1 } } },
          { $sort: { orderCount: -1 } },
          { $limit: 10 },
          { $lookup: { from: 'tenancies', localField: '_id', foreignField: '_id', as: 'tenancy' } },
          { $unwind: '$tenancy' },
          { $project: { name: '$tenancy.name', subdomain: '$tenancy.subdomain', orderCount: 1 } }
        ]),
        Order.aggregate([
          { $match: { createdAt: { $gte: startDate } } },
          { $group: { _id: '$tenancy', revenue: { $sum: '$pricing.total' } } },
          { $sort: { revenue: -1 } },
          { $limit: 10 },
          { $lookup: { from: 'tenancies', localField: '_id', foreignField: '_id', as: 'tenancy' } },
          { $unwind: '$tenancy' },
          { $project: { name: '$tenancy.name', subdomain: '$tenancy.subdomain', revenue: 1 } }
        ]),
        TenancyPayment.aggregate([
          { $match: { status: 'completed', createdAt: { $gte: startDate } } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]),
        Tenancy.aggregate([
          { $match: { createdAt: { $gte: startDate } } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              count: { $sum: 1 }
            }
          },
          { $sort: { _id: 1 } }
        ])
      ]);
      
      res.json({
        success: true,
        data: {
          overview: {
            totalTenancies,
            activeTenancies,
            newTenancies,
            platformRevenue: platformRevenue[0]?.total || 0
          },
          tenanciesByPlan: tenanciesByPlan.reduce((acc, item) => {
            acc[item._id || 'free'] = item.count;
            return acc;
          }, {}),
          tenanciesByStatus: tenanciesByStatus.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, {}),
          topTenanciesByOrders,
          topTenanciesByRevenue,
          dailySignups
        }
      });
    } catch (error) {
      console.error('Get platform analytics error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch platform analytics' });
    }
  },

  // Get tenancy comparison
  compareTenancies: async (req, res) => {
    try {
      const { tenancyIds } = req.body;
      const { period = '30d' } = req.query;
      
      if (!tenancyIds || !Array.isArray(tenancyIds) || tenancyIds.length === 0) {
        return res.status(400).json({ success: false, message: 'Tenancy IDs required' });
      }
      
      const now = new Date();
      let startDate = new Date();
      switch (period) {
        case '7d': startDate.setDate(now.getDate() - 7); break;
        case '30d': startDate.setDate(now.getDate() - 30); break;
        case '90d': startDate.setDate(now.getDate() - 90); break;
        default: startDate.setDate(now.getDate() - 30);
      }
      
      const comparisons = await Promise.all(
        tenancyIds.map(async (tenancyId) => {
          const [tenancy, orders, revenue, customers] = await Promise.all([
            Tenancy.findById(tenancyId).select('name subdomain subscription.plan status'),
            Order.countDocuments({ tenancy: tenancyId, createdAt: { $gte: startDate } }),
            Order.aggregate([
              { $match: { tenancy: require('mongoose').Types.ObjectId(tenancyId), createdAt: { $gte: startDate } } },
              { $group: { _id: null, total: { $sum: '$pricing.total' } } }
            ]),
            User.countDocuments({ tenancy: tenancyId, role: 'customer' })
          ]);
          
          return {
            tenancyId,
            name: tenancy?.name || 'Unknown',
            subdomain: tenancy?.subdomain,
            plan: tenancy?.subscription?.plan,
            status: tenancy?.status,
            orders,
            revenue: revenue[0]?.total || 0,
            customers
          };
        })
      );
      
      res.json({
        success: true,
        data: { comparisons }
      });
    } catch (error) {
      console.error('Compare tenancies error:', error);
      res.status(500).json({ success: false, message: 'Failed to compare tenancies' });
    }
  }
};

module.exports = tenancyAnalyticsController;
