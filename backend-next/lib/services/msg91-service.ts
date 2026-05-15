import axios from 'axios';
import { getLogger } from '../logger';

const logger = getLogger('services.msg91');

const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY;
const MSG91_TEMPLATE_ID = process.env.MSG91_TEMPLATE_ID;
const MSG91_BASE_URL = 'https://control.msg91.com/api/v5/otp';

export const msg91Service = {
  /**
   * Send OTP to a mobile number
   * @param phone 10-digit mobile number
   */
  sendOtp: async (phone: string) => {
    if (!MSG91_AUTH_KEY || !MSG91_TEMPLATE_ID) {
      logger.error('MSG91 configuration missing');
      throw new Error('OTP service not configured');
    }

    // Ensure 10 digit phone
    const cleanedPhone = phone.replace(/\D/g, '').slice(-10);
    const mobile = `91${cleanedPhone}`;

    try {
      logger.info('msg91.send_otp.start', { mobile });
      const response = await axios.post(MSG91_BASE_URL, {
        template_id: MSG91_TEMPLATE_ID,
        mobile: mobile,
      }, {
        headers: {
          'authkey': MSG91_AUTH_KEY,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.type === 'success') {
        logger.info('msg91.send_otp.success', { mobile });
        return { success: true };
      } else {
        logger.error('msg91.send_otp.failed', { mobile, response: response.data });
        throw new Error(response.data.message || 'Failed to send OTP');
      }
    } catch (error: any) {
      logger.error('msg91.send_otp.error', { mobile, error: error.message });
      throw new Error(error.response?.data?.message || error.message || 'OTP delivery failed');
    }
  },

  /**
   * Verify OTP for a mobile number
   * @param phone 10-digit mobile number
   * @param otp 4-6 digit OTP
   */
  verifyOtp: async (phone: string, otp: string) => {
    if (!MSG91_AUTH_KEY) {
      throw new Error('OTP service not configured');
    }

    const cleanedPhone = phone.replace(/\D/g, '').slice(-10);
    const mobile = `91${cleanedPhone}`;

    try {
      logger.info('msg91.verify_otp.start', { mobile });
      const response = await axios.get(`${MSG91_BASE_URL}/verify`, {
        params: {
          otp: otp,
          mobile: mobile,
          authkey: MSG91_AUTH_KEY
        }
      });

      if (response.data.type === 'success') {
        logger.info('msg91.verify_otp.success', { mobile });
        return { success: true };
      } else {
        logger.error('msg91.verify_otp.failed', { mobile, response: response.data });
        throw new Error(response.data.message || 'Invalid OTP');
      }
    } catch (error: any) {
      logger.error('msg91.verify_otp.error', { mobile, error: error.message });
      throw new Error(error.response?.data?.message || error.message || 'OTP verification failed');
    }
  }
};
