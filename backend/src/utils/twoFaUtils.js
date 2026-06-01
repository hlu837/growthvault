import crypto from 'crypto';

const CODE_LENGTH = parseInt(process.env.TWO_FA_CODE_LENGTH) || 6;
const CODE_EXPIRY = parseInt(process.env.TWO_FA_CODE_EXPIRY) || 600000; // 10 minutes

export const generateVerificationCode = () => {
  return Math.floor(Math.random() * Math.pow(10, CODE_LENGTH))
    .toString()
    .padStart(CODE_LENGTH, '0');
};

export const getCodeExpiry = () => {
  return new Date(Date.now() + CODE_EXPIRY).toISOString();
};

export const isCodeExpired = (expiresAt) => {
  return new Date(expiresAt) < new Date();
};

export const validateCodeFormat = (code) => {
  return /^\d{6}$/.test(code);
};
