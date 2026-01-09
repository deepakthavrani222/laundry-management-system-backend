const BannerTemplate = require('../models/BannerTemplate');
const sharp = require('sharp');

class BannerValidationService {
  /**
   * Validate banner content against template
   */
  async validateAgainstTemplate(bannerData, template) {
    console.log('🔍 validateAgainstTemplate called with:');
    console.log('  - bannerData.imageUrl:', bannerData.imageUrl);
    console.log('  - template.layout.image.required:', template.layout.image.required);
    
    const errors = [];
    
    // Validate content fields
    if (template.layout.fields && template.layout.fields.length > 0) {
      for (const field of template.layout.fields) {
        const value = bannerData.content[field.name];
        
        // Check required fields
        if (field.required && (!value || value.trim() === '')) {
          errors.push(`Field '${field.name}' is required`);
          continue;
        }
        
        // Check max length
        if (value && field.maxLength && value.length > field.maxLength) {
          errors.push(`Field '${field.name}' exceeds maximum length of ${field.maxLength} characters`);
        }
      }
    }
    
    // Validate title length
    if (bannerData.content.title) {
      if (template.design.maxTitleLength && bannerData.content.title.length > template.design.maxTitleLength) {
        errors.push(`Title exceeds maximum length of ${template.design.maxTitleLength} characters`);
      }
    }
    
    // Validate subtitle length
    if (bannerData.content.subtitle) {
      if (template.design.maxSubtitleLength && bannerData.content.subtitle.length > template.design.maxSubtitleLength) {
        errors.push(`Subtitle exceeds maximum length of ${template.design.maxSubtitleLength} characters`);
      }
    }
    
    // Validate description length
    if (bannerData.content.description) {
      if (template.design.maxDescriptionLength && bannerData.content.description.length > template.design.maxDescriptionLength) {
        errors.push(`Description exceeds maximum length of ${template.design.maxDescriptionLength} characters`);
      }
    }
    
    // Validate CTA
    if (template.layout.cta.enabled) {
      if (bannerData.cta && bannerData.cta.text) {
        if (bannerData.cta.text.length > template.layout.cta.maxLength) {
          errors.push(`CTA text exceeds maximum length of ${template.layout.cta.maxLength} characters`);
        }
      }
    }
    
    // Validate image requirement
    if (template.layout.image.required) {
      console.log('🖼️ Image validation - required:', template.layout.image.required);
      console.log('🖼️ Image validation - imageUrl provided:', bannerData.imageUrl);
      console.log('🖼️ Image validation - imageUrl type:', typeof bannerData.imageUrl);
      console.log('🖼️ Image validation - full bannerData:', JSON.stringify(bannerData, null, 2));
      
      // Check if imageUrl exists and is not empty
      const hasImage = bannerData.imageUrl && 
                       typeof bannerData.imageUrl === 'string' && 
                       bannerData.imageUrl.trim() !== '';
      
      if (!hasImage) {
        console.log('❌ Image validation failed - no valid imageUrl');
        errors.push('Image is required for this template');
      } else {
        console.log('✅ Image validation passed - imageUrl:', bannerData.imageUrl);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Validate image dimensions and size
   */
  async validateImageDimensions(imageBuffer, template) {
    try {
      const metadata = await sharp(imageBuffer).metadata();
      const errors = [];
      
      // Check dimensions
      if (template.layout.image.width > 0 && template.layout.image.height > 0) {
        const expectedWidth = template.layout.image.width;
        const expectedHeight = template.layout.image.height;
        
        // Allow 10% tolerance
        const widthTolerance = expectedWidth * 0.1;
        const heightTolerance = expectedHeight * 0.1;
        
        if (Math.abs(metadata.width - expectedWidth) > widthTolerance) {
          errors.push(`Image width should be approximately ${expectedWidth}px (got ${metadata.width}px)`);
        }
        
        if (Math.abs(metadata.height - expectedHeight) > heightTolerance) {
          errors.push(`Image height should be approximately ${expectedHeight}px (got ${metadata.height}px)`);
        }
      }
      
      // Check file size
      const fileSizeKB = imageBuffer.length / 1024;
      if (template.layout.image.maxSizeKB && fileSizeKB > template.layout.image.maxSizeKB) {
        errors.push(`Image size (${Math.round(fileSizeKB)}KB) exceeds maximum of ${template.layout.image.maxSizeKB}KB`);
      }
      
      return {
        valid: errors.length === 0,
        errors,
        metadata: {
          width: metadata.width,
          height: metadata.height,
          format: metadata.format,
          sizeKB: Math.round(fileSizeKB)
        }
      };
    } catch (error) {
      return {
        valid: false,
        errors: ['Invalid image file or corrupted image'],
        metadata: null
      };
    }
  }
  
  /**
   * Validate position is allowed for template
   */
  validatePosition(position, template) {
    if (!template.allowedPositions.includes(position)) {
      return {
        valid: false,
        message: `Position '${position}' is not allowed for this template. Allowed positions: ${template.allowedPositions.join(', ')}`
      };
    }
    
    return { valid: true };
  }
  
  /**
   * Validate schedule dates
   */
  validateSchedule(startDate, endDate) {
    const errors = [];
    const now = new Date();
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Check if dates are valid
    if (isNaN(start.getTime())) {
      errors.push('Invalid start date');
    }
    
    if (isNaN(end.getTime())) {
      errors.push('Invalid end date');
    }
    
    // Check if end date is after start date
    if (end <= start) {
      errors.push('End date must be after start date');
    }
    
    // Check if end date is in the past
    if (end < now) {
      errors.push('End date cannot be in the past');
    }
    
    // Check if duration is reasonable (not more than 1 year)
    const durationDays = (end - start) / (1000 * 60 * 60 * 24);
    if (durationDays > 365) {
      errors.push('Banner duration cannot exceed 1 year');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Validate complete banner data
   */
  async validateBannerData(bannerData, templateId) {
    try {
      // Get template
      const template = await BannerTemplate.findById(templateId);
      if (!template) {
        return {
          valid: false,
          errors: ['Template not found']
        };
      }
      
      if (template.status !== 'ACTIVE') {
        return {
          valid: false,
          errors: ['Template is not active']
        };
      }
      
      const allErrors = [];
      
      // Validate content against template
      const contentValidation = await this.validateAgainstTemplate(bannerData, template);
      if (!contentValidation.valid) {
        allErrors.push(...contentValidation.errors);
      }
      
      // Validate position
      if (bannerData.position) {
        const positionValidation = this.validatePosition(bannerData.position, template);
        if (!positionValidation.valid) {
          allErrors.push(positionValidation.message);
        }
      } else {
        allErrors.push('Position is required');
      }
      
      // Validate schedule
      if (bannerData.schedule) {
        const scheduleValidation = this.validateSchedule(
          bannerData.schedule.startDate,
          bannerData.schedule.endDate
        );
        if (!scheduleValidation.valid) {
          allErrors.push(...scheduleValidation.errors);
        }
      } else {
        allErrors.push('Schedule is required');
      }
      
      // Validate linked campaign (optional)
      // Campaign is optional - informational banners may not have campaigns
      
      return {
        valid: allErrors.length === 0,
        errors: allErrors,
        template
      };
    } catch (error) {
      return {
        valid: false,
        errors: [`Validation error: ${error.message}`]
      };
    }
  }
  
  /**
   * Get validation rules for a template
   */
  async getValidationRules(templateId) {
    try {
      const template = await BannerTemplate.findById(templateId);
      if (!template) {
        return { success: false, message: 'Template not found' };
      }
      
      const rules = {
        templateType: template.type,
        image: {
          required: template.layout.image.required,
          width: template.layout.image.width,
          height: template.layout.image.height,
          aspectRatio: template.layout.image.aspectRatio,
          maxSizeKB: template.layout.image.maxSizeKB
        },
        fields: template.layout.fields.map(field => ({
          name: field.name,
          type: field.type,
          required: field.required,
          maxLength: field.maxLength,
          placeholder: field.placeholder
        })),
        cta: {
          enabled: template.layout.cta.enabled,
          maxLength: template.layout.cta.maxLength,
          secondaryEnabled: template.layout.cta.secondary?.enabled || false
        },
        allowedPositions: template.allowedPositions,
        design: {
          maxTitleLength: template.design.maxTitleLength,
          maxSubtitleLength: template.design.maxSubtitleLength,
          maxDescriptionLength: template.design.maxDescriptionLength
        }
      };
      
      return {
        success: true,
        data: rules
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}

module.exports = new BannerValidationService();
