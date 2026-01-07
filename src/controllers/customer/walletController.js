const User = require('../../models/User');

// Get wallet balance
const getWalletBalance = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const user = await User.findById(userId).select('wallet');
    
    if (!user || !user.wallet) {
      return res.json({
        success: true,
        data: {
          balance: 0,
          currency: 'INR'
        }
      });
    }
    
    res.json({
      success: true,
      data: {
        balance: user.wallet.balance || 0,
        currency: 'INR'
      }
    });
  } catch (error) {
    console.error('Get wallet balance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch wallet balance'
    });
  }
};

// Get wallet transaction history
const getWalletTransactions = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20, type } = req.query;
    
    const user = await User.findById(userId).select('wallet');
    
    if (!user || !user.wallet || !user.wallet.transactions) {
      return res.json({
        success: true,
        data: {
          transactions: [],
          pagination: { current: 1, pages: 0, total: 0 }
        }
      });
    }
    
    let transactions = user.wallet.transactions || [];
    
    // Filter by type if specified
    if (type) {
      transactions = transactions.filter(t => t.type === type);
    }
    
    // Sort by date (newest first)
    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Pagination
    const total = transactions.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedTransactions = transactions.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      data: {
        transactions: paginatedTransactions,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get wallet transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch wallet transactions'
    });
  }
};

// Add money to wallet (placeholder - integrate with payment gateway)
const addMoneyToWallet = async (req, res) => {
  try {
    const userId = req.user._id;
    const { amount, paymentMethod, transactionId } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount'
      });
    }
    
    // TODO: Integrate with payment gateway
    // For now, this is a placeholder
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Initialize wallet if doesn't exist
    if (!user.wallet) {
      user.wallet = {
        balance: 0,
        transactions: []
      };
    }
    
    // Add money
    user.wallet.balance += amount;
    
    // Add transaction record
    user.wallet.transactions.push({
      type: 'credit',
      amount,
      description: 'Money added to wallet',
      date: new Date(),
      paymentMethod,
      transactionId,
      balanceAfter: user.wallet.balance
    });
    
    await user.save();
    
    res.json({
      success: true,
      message: 'Money added to wallet successfully',
      data: {
        newBalance: user.wallet.balance,
        amountAdded: amount
      }
    });
  } catch (error) {
    console.error('Add money to wallet error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add money to wallet'
    });
  }
};

module.exports = {
  getWalletBalance,
  getWalletTransactions,
  addMoneyToWallet
};
