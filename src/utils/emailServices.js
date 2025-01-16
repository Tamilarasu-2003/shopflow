
const nodemailer = require('nodemailer');


const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, 
    pass: process.env.EMAIL_PASS,
  },
});

const sendPasswordResetEmail = async (email, resetURL) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Password Reset Request',
    text: `You requested a password reset. Click the link below to reset your password: \n\n${resetURL}`,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending reset email:', error);
    throw new Error('Failed to send email');
  }
};

module.exports = {
  sendPasswordResetEmail,
};
