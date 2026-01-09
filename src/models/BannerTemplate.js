const mongoose = require('mongoose');

const bannerTemplateSchema = new mongoose.Schema({
  // Basic Info
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    enum: ['HERO', 'SLIDER', 'STRIP', 'CARD', 'MODAL', 'FLOATING']
  },
  description: {
    type: String,
    trim: true
  },
  
  // Template Type
  type: {
    type: String,
    enum: ['HERO', 'SLIDER', 'STRIP', 'CARD', 'MODAL', 'FLOATING'],
    required: true
  },
  
  // Layout Configuration
  layout: {
    // Image specifications
    image: {
      width: {
        type: Number,
        default: 0
      },
      height: {
        type: Number,
        default: 0
      },
      aspectRatio: {
        type: String,
        default: '16:9'
      },
      required: {
        type: Boolean,
        default: false
      },
      maxSizeKB: {
        type: Number,
        default: 500
      }
    },
    
    // Text fields configuration
    fields: [{
      name: {
        type: String,
        required: true
      },
      type: {
        type: String,
        enum: ['TEXT', 'TEXTAREA', 'RICH_TEXT'],
        default: 'TEXT'
      },
      maxLength: {
        type: Number,
        default: 100
      },
      required: {
        type: Boolean,
        default: false
      },
      placeholder: String
    }],
    
    // CTA configuration
    cta: {
      enabled: {
        type: Boolean,
        default: true
      },
      maxLength: {
        type: Number,
        default: 20
      },
      defaultText: {
        type: String,
        default: 'Learn More'
      },
      secondary: {
        enabled: {
          type: Boolean,
          default: false
        },
        maxLength: {
          type: Number,
          default: 20
        }
      }
    }
  },
  
  // Allowed Positions
  allowedPositions: [{
    type: String,
    enum: [
      // Home positions
      'HOME_HERO_TOP',
      'HOME_SLIDER_MID',
      'HOME_STRIP_TOP',
      'HOME_STRIP_BOTTOM',
      'HOME_CARD_SIDEBAR',
      // Services positions
      'SERVICES_HERO_TOP',
      'SERVICES_SLIDER_MID',
      'SERVICES_CARD_GRID',
      // Offers positions
      'OFFERS_HERO_TOP',
      'OFFERS_SLIDER_MID',
      'OFFERS_CARD_GRID',
      // Checkout positions
      'CHECKOUT_STRIP_TOP',
      'CHECKOUT_CARD_SIDEBAR',
      // Dashboard positions
      'DASHBOARD_HERO_TOP',
      'DASHBOARD_CARD_GRID',
      // Login positions
      'LOGIN_HERO_SIDE',
      'LOGIN_STRIP_TOP',
      // Global positions
      'GLOBAL_STRIP_TOP',
      'GLOBAL_MODAL_CENTER',
      'GLOBAL_FLOATING_CORNER'
    ]
  }],
  
  // Design Rules
  design: {
    // Text length constraints
    maxTitleLength: {
      type: Number,
      default: 60
    },
    maxSubtitleLength: {
      type: Number,
      default: 120
    },
    maxDescriptionLength: {
      type: Number,
      default: 200
    },
    
    // Color scheme
    allowCustomColors: {
      type: Boolean,
      default: false
    },
    defaultColors: {
      background: {
        type: String,
        default: '#ffffff'
      },
      text: {
        type: String,
        default: '#000000'
      },
      cta: {
        type: String,
        default: '#14b8a6'
      }
    },
    
    // Animation
    animation: {
      type: String,
      enum: ['NONE', 'FADE', 'SLIDE', 'ZOOM'],
      default: 'FADE'
    }
  },
  
  // Additional Settings (for specific types)
  settings: {
    // For SLIDER
    autoRotate: {
      type: Boolean,
      default: false
    },
    rotateInterval: {
      type: Number,
      default: 5000 // milliseconds
    },
    maxBanners: {
      type: Number,
      default: 5
    },
    
    // For STRIP
    dismissible: {
      type: Boolean,
      default: false
    },
    sticky: {
      type: Boolean,
      default: false
    },
    height: {
      type: Number,
      default: 60 // pixels
    },
    
    // For MODAL
    overlay: {
      type: Boolean,
      default: true
    },
    triggers: [{
      type: String,
      enum: ['ON_LOAD', 'EXIT_INTENT', 'TIMED', 'SCROLL']
    }],
    modalSize: {
      width: {
        type: Number,
        default: 500
      },
      height: {
        type: Number,
        default: 600
      }
    },
    
    // For FLOATING
    position: {
      type: String,
      enum: ['BOTTOM_RIGHT', 'BOTTOM_LEFT', 'TOP_RIGHT', 'TOP_LEFT'],
      default: 'BOTTOM_RIGHT'
    },
    floatingSize: {
      width: {
        type: Number,
        default: 250
      },
      height: {
        type: Number,
        default: 150
      }
    },
    
    // For CARD
    compact: {
      type: Boolean,
      default: false
    }
  },
  
  // Responsive Configuration
  responsive: {
    desktop: {
      show: {
        type: Boolean,
        default: true
      },
      fullWidth: {
        type: Boolean,
        default: false
      },
      columns: {
        type: Number,
        default: 1
      }
    },
    tablet: {
      show: {
        type: Boolean,
        default: true
      },
      fullWidth: {
        type: Boolean,
        default: false
      },
      columns: {
        type: Number,
        default: 1
      }
    },
    mobile: {
      show: {
        type: Boolean,
        default: true
      },
      fullWidth: {
        type: Boolean,
        default: true
      },
      columns: {
        type: Number,
        default: 1
      }
    }
  },
  
  // Preview
  previewImage: {
    type: String,
    default: ''
  },
  
  // Status
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE'],
    default: 'ACTIVE'
  },
  
  // Usage Statistics
  usageCount: {
    type: Number,
    default: 0
  },
  
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
bannerTemplateSchema.index({ code: 1 });
bannerTemplateSchema.index({ type: 1 });
bannerTemplateSchema.index({ status: 1 });

// Methods
bannerTemplateSchema.methods.incrementUsage = function() {
  this.usageCount += 1;
  return this.save();
};

bannerTemplateSchema.methods.isPositionAllowed = function(position) {
  return this.allowedPositions.includes(position);
};

// Statics
bannerTemplateSchema.statics.getActiveTemplates = function() {
  return this.find({ status: 'ACTIVE' }).sort({ type: 1, name: 1 });
};

bannerTemplateSchema.statics.getTemplateByCode = function(code) {
  return this.findOne({ code: code.toUpperCase(), status: 'ACTIVE' });
};

bannerTemplateSchema.statics.getTemplatesByType = function(type) {
  return this.find({ type, status: 'ACTIVE' }).sort({ name: 1 });
};

module.exports = mongoose.model('BannerTemplate', bannerTemplateSchema);
