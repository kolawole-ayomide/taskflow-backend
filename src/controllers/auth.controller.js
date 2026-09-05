const authService = require('../services/auth.service');

const signup = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    const data = await authService.registerUser({ name, email, password });
    return res.status(201).json(data);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const data = await authService.loginUser({ email, password });
    return res.status(200).json(data);
  } catch (error) {
    return res.status(401).json({ message: error.message });
  }
};

const getMe = async (req, res) => {
  return res.status(200).json({ user: req.user });
};

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    await authService.requestPasswordReset({ email });
    return res.status(200).json({ message: 'If an account with that email exists, a reset link has been sent.' });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token and newPassword are required' });
    }

    await authService.resetPassword({ token, newPassword });
    return res.status(200).json({ message: 'Password reset successfully. You can now log in.' });
  } catch (error) {
    next(error);
  }
};

const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ message: 'Token is required' });
    }

    await authService.verifyEmail({ token });
    return res.status(200).json({ message: 'Email verified successfully.' });
  } catch (error) {
    next(error);
  }
};

const resendVerification = async (req, res, next) => {
  try {
    await authService.resendVerification({ userId: req.user.id });
    return res.status(200).json({ message: 'Verification email sent.' });
  } catch (error) {
    next(error);
  }
};

module.exports = { signup, login, getMe, forgotPassword, resetPassword, verifyEmail, resendVerification };