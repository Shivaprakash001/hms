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
      console.error('MSG91 configuration missing', {
        authKeyExists: Boolean(MSG91_AUTH_KEY),
        templateIdExists: Boolean(MSG91_TEMPLATE_ID),
      });
      throw new Error('OTP service not configured');
    }

    const cleanedPhone = phone.replace(/\D/g, '').slice(-10);
    const mobile = `91${cleanedPhone}`;
    const payload = {
      template_id: MSG91_TEMPLATE_ID,
      mobile,
    };

    try {
      logger.info('msg91.send_otp.start', { mobile });
      console.log('MSG91 Send OTP Config:', {
        url: MSG91_BASE_URL,
        phone,
        mobile,
        templateId: MSG91_TEMPLATE_ID,
        authKeyExists: Boolean(MSG91_AUTH_KEY),
        authHeaderName: 'authkey',
      });
      console.log('MSG91 Request Payload:', payload);

      const response = await axios.post(MSG91_BASE_URL, payload, {
        headers: {
          'authkey': MSG91_AUTH_KEY,
          'Content-Type': 'application/json'
        },
        validateStatus: () => true,
      });

      console.log('MSG91 Response Status:', response.status);
      console.log('MSG91 Response:', response.data);

      if (response.data.type === 'success') {
        logger.info('msg91.send_otp.success', { mobile });
        return { success: true };
      } else {
        logger.error('msg91.send_otp.failed', { mobile, status: response.status, response: response.data });
        console.error('MSG91 Error:', {
          status: response.status,
          response: response.data,
        });
        throw new Error(response.data?.message || response.data?.error || `MSG91 failed with status ${response.status}`);
      }
    } catch (error: any) {
      logger.error('msg91.send_otp.error', { mobile, error: error.message, response: error.response?.data });
      console.error('MSG91 Error:', {
        message: error.message,
        status: error.response?.status,
        response: error.response?.data,
        stack: error.stack,
      });
      throw new Error(error.response?.data?.message || error.response?.data?.error || error.message || 'OTP delivery failed');
    }
  },

  /**
   * Verify OTP for a mobile number
   * @param phone 10-digit mobile number
   * @param otp 4-6 digit OTP
   */
  verifyOtp: async (phone: string, otp: string) => {
    if (!MSG91_AUTH_KEY) {
      console.error('MSG91 configuration missing', {
        authKeyExists: Boolean(MSG91_AUTH_KEY),
        templateIdExists: Boolean(MSG91_TEMPLATE_ID),
      });
      throw new Error('OTP service not configured');
    }

    const cleanedPhone = phone.replace(/\D/g, '').slice(-10);
    const mobile = `91${cleanedPhone}`;

    try {
      logger.info('msg91.verify_otp.start', { mobile });
      console.log('MSG91 Verify OTP Config:', {
        url: `${MSG91_BASE_URL}/verify`,
        phone,
        mobile,
        authKeyExists: Boolean(MSG91_AUTH_KEY),
      });
      const response = await axios.get(`${MSG91_BASE_URL}/verify`, {
        params: {
          otp: otp,
          mobile: mobile,
          authkey: MSG91_AUTH_KEY
        },
        validateStatus: () => true,
      });

      console.log('MSG91 Verify Response Status:', response.status);
      console.log('MSG91 Verify Response:', response.data);

      if (response.data.type === 'success') {
        logger.info('msg91.verify_otp.success', { mobile });
        return { success: true };
      } else {
        logger.error('msg91.verify_otp.failed', { mobile, status: response.status, response: response.data });
        console.error('MSG91 Error:', {
          status: response.status,
          response: response.data,
        });
        throw new Error(response.data?.message || response.data?.error || `MSG91 verification failed with status ${response.status}`);
      }
    } catch (error: any) {
      logger.error('msg91.verify_otp.error', { mobile, error: error.message, response: error.response?.data });
      console.error('MSG91 Error:', {
        message: error.message,
        status: error.response?.status,
        response: error.response?.data,
        stack: error.stack,
      });
      throw new Error(error.response?.data?.message || error.response?.data?.error || error.message || 'OTP verification failed');
    }
  }
};
