const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const sendEmail = require('../utils/email');
const userRepository = require('../repositories/userRepository');
const AppError = require('../utils/appError');

class AuthService {
  signToken(id) {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN,
    });
  }

  async createSendToken(user, statusCode, res) {
    const token = this.signToken(user._id);
    const cookieOptions = {
      expires: new Date(
        Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
      ),
      httpOnly: true,
    };
    if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;

    res.cookie('jwt', token, cookieOptions);
    user.password = undefined;

    res.status(statusCode).json({
      status: 'success',
      token,
      data: { user },
    });
  }

  async sendPasswordResetEmail(user, resetToken, req) {
    const resetURL = `${req.protocol}://${req.get(
      'host'
    )}/api/v1/auth/resetPassword/${resetToken}`;
    const message = `Forgot your password? Send a PATCH with your new password and passwordConfirm to: ${resetURL}.\nIf you didn’t request this, ignore this email.`;

    await sendEmail({
      email: user.email,
      subject: 'Your password reset token (valid for 10 min)',
      message,
    });
  }
}

module.exports = new AuthService();
