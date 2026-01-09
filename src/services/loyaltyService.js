const { LoyaltyProgram, LoyaltyTransaction } = require('../models/LoyaltyProgram');
const User = require('../models/User');

class LoyaltyService {
  /**
   * Award loyalty points for a completed order
   * @param {String} customerId - Customer ID
   * @param {Object} order - Order object
   */
  static async awardPointsForOrder(customerId, order) {
    try {
      // Get active loyalty program for this tenancy
      const program = await LoyaltyProgram.findOne({
        tenancy: order.tenancy,
        type: 'points',
        isActive: true,
        startDate: { $lte: new Date() },
        $or: [
          { endDate: { $exists: false } },
          { endDate: { $gte: new Date() } }
        ]
      });

      if (!program) {
        console.log('❌ No active loyalty program found for tenancy:', order.tenancy);
        return;
      }

      console.log('✅ Found active loyalty program:', program.name);

      // Get or create loyalty member
      const { LoyaltyMember } = require('../models/LoyaltyProgram');
      let member = await LoyaltyMember.findOne({
        user: customerId,
        program: program._id,
        tenancy: order.tenancy
      });

      if (!member) {
        console.log('📝 Creating new loyalty member for customer:', customerId);
        member = new LoyaltyMember({
          tenancy: order.tenancy,
          program: program._id,
          user: customerId,
          pointsBalance: 0,
          lifetimePoints: 0,
          enrollmentSource: 'first_order'
        });
        await member.save();
      }

      // Calculate points based on order amount
      const orderAmount = order.pricing?.total || 0;
      const earningRate = program.pointsConfig?.earningRate || 1;
      const pointsEarned = Math.floor(orderAmount * earningRate);

      if (pointsEarned <= 0) {
        console.log('⚠️ No points to award for order:', order.orderNumber);
        return;
      }

      // Check if this is first order for bonus points
      const isFirstOrder = await this.isFirstOrder(customerId, order.tenancy);
      let bonusPoints = 0;

      if (isFirstOrder) {
        const firstOrderBonus = program.pointsConfig?.bonusActions?.find(
          action => action.action === 'first_order'
        );
        if (firstOrderBonus) {
          bonusPoints = firstOrderBonus.points || 0;
        }
      }

      const totalPoints = pointsEarned + bonusPoints;

      // Create loyalty transaction
      const transaction = new LoyaltyTransaction({
        tenancy: order.tenancy,
        member: member._id,
        order: order._id,
        type: 'earned',
        points: totalPoints,
        description: `Points earned for order ${order.orderNumber}${isFirstOrder ? ' (First Order Bonus)' : ''}`,
        earningSource: 'purchase',
        orderValue: orderAmount
      });

      await transaction.save();

      // Update member balance
      member.pointsBalance += totalPoints;
      member.lifetimePoints += totalPoints;
      member.lastActivity = new Date();
      await member.save();

      console.log(`✅ Awarded ${totalPoints} loyalty points to customer ${customerId} for order ${order.orderNumber}`);
      console.log(`   - Base points: ${pointsEarned}`);
      console.log(`   - Bonus points: ${bonusPoints}`);
      console.log(`   - New balance: ${member.pointsBalance}`);

      return transaction;
    } catch (error) {
      console.error('❌ Error awarding loyalty points:', error);
      throw error;
    }
  }

  /**
   * Check if this is customer's first order
   * @param {String} customerId - Customer ID
   * @param {String} tenancyId - Tenancy ID
   */
  static async isFirstOrder(customerId, tenancyId) {
    try {
      const Order = require('../models/Order');
      const orderCount = await Order.countDocuments({
        customer: customerId,
        tenancy: tenancyId,
        status: 'DELIVERED'
      });
      return orderCount === 1; // This is the first delivered order
    } catch (error) {
      console.error('Error checking first order:', error);
      return false;
    }
  }

  /**
   * Get customer's loyalty balance
   * @param {String} customerId - Customer ID
   * @param {String} tenancyId - Tenancy ID
   */
  static async getBalance(customerId, tenancyId) {
    try {
      const { LoyaltyMember } = require('../models/LoyaltyProgram');
      
      const member = await LoyaltyMember.findOne({
        user: customerId,
        tenancy: tenancyId
      });

      return member ? member.pointsBalance : 0;
    } catch (error) {
      console.error('Error getting loyalty balance:', error);
      return 0;
    }
  }

  /**
   * Redeem loyalty points
   * @param {String} customerId - Customer ID
   * @param {String} tenancyId - Tenancy ID
   * @param {Number} points - Points to redeem
   * @param {Object} order - Order object
   */
  static async redeemPoints(customerId, tenancyId, points, order) {
    try {
      const { LoyaltyMember } = require('../models/LoyaltyProgram');
      
      // Get member
      const member = await LoyaltyMember.findOne({
        user: customerId,
        tenancy: tenancyId
      });

      if (!member) {
        throw new Error('Loyalty member not found');
      }

      // Check balance
      if (member.pointsBalance < points) {
        throw new Error('Insufficient loyalty points');
      }

      // Get program for redemption rate
      const program = await LoyaltyProgram.findById(member.program);

      if (!program) {
        throw new Error('No active loyalty program found');
      }

      // Calculate redemption value
      const redemptionRate = program.pointsConfig?.redemptionRate || 100;
      const creditValue = points / redemptionRate;

      // Create redemption transaction
      const transaction = new LoyaltyTransaction({
        tenancy: tenancyId,
        member: member._id,
        order: order._id,
        type: 'redeemed',
        points: points,
        description: `Points redeemed for order ${order.orderNumber}`,
        redemptionType: 'credit',
        redemptionValue: creditValue
      });

      await transaction.save();

      // Update member balance
      member.pointsBalance -= points;
      member.redeemedPoints += points;
      member.lastActivity = new Date();
      await member.save();

      console.log(`✅ Redeemed ${points} loyalty points for customer ${customerId}`);

      return { transaction, creditValue };
    } catch (error) {
      console.error('Error redeeming loyalty points:', error);
      throw error;
    }
  }
}

module.exports = LoyaltyService;
