const nodemailer = require("nodemailer");
const { login } = require("./validationSchema");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendPasswordResetEmail = async (email, resetURL) => {
  console.log("resetURL : ", resetURL);

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `Password Reset Request - ${Date.now()}`,
    html: `
      <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 20px auto;
            background: #ffffff;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.1);
          }
          .header {
            background: #007bff;
            color: #ffffff;
            padding: 15px;
            text-align: center;
            font-size: 20px;
            font-weight: bold;
            border-radius: 8px 8px 0 0;
          }
          .content {
            padding: 20px;
            font-size: 16px;
            color: #333333;
          }
          .button-container {
            text-align: center;
            margin-top: 20px;
          }
          .reset-button {
            display: inline-block;
            padding: 10px 20px;
            font-size: 16px;
            color: #ffffff;
            background-color: #007bff;
            text-decoration: none;
            border-radius: 5px;
          }
          .footer {
            text-align: center;
            font-size: 14px;
            color: #666666;
            margin-top: 20px;
            padding-top: 15px;
            border-top: 1px solid #dddddd;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            Password Reset Request
          </div>
          <div class="content">
            <p>Dear User,</p>
            <p>You requested a password reset. Click the button below to reset your password:</p>
            <div class="button-container">
              <a class="reset-button" href="${resetURL}" target="_blank">Reset Password</a>
            </div>
            <p>If you didn’t request a password reset, you can ignore this email.</p>
            <p>This link will expire in 10 minutes for security reasons.</p>
          </div>
          <div class="footer">
            If you need further assistance, please contact our support team.
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Error sending reset email:", error);
    throw new Error("Failed to send email");
  }
};

const orderUpdateEmail = async (email, data, update) => {
  const deliveryDate = new Date(data.orderDate);
  deliveryDate.setDate(deliveryDate.getDate() + 2);

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `Order Confirmation - Order #${data.id}`,
    html: `
        <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              background-color: #f4f4f4;
              margin: 0;
              padding: 0;
            }
            .container {
              max-width: 600px;
              margin: 20px auto;
              background: #ffffff;
              padding: 20px;
              border-radius: 8px;
              box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.1);
            }
            .header {
              background: #007bff;
              color: #ffffff;
              padding: 15px;
              text-align: center;
              font-size: 20px;
              font-weight: bold;
              border-radius: 8px 8px 0 0;
            }
            .content {
              padding: 20px;
              font-size: 16px;
              color: #333333;
            }
            .order-details {
              background: #f9f9f9;
              padding: 10px;
              border-radius: 5px;
              margin-top: 15px;
            }
            .order-details p {
              margin: 5px 0;
            }
            .footer {
              text-align: center;
              font-size: 14px;
              color: #666666;
              margin-top: 20px;
              padding-top: 15px;
              border-top: 1px solid #dddddd;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              Thank you for choosing SHOPFLOW!
            </div>
            <div class="content">
              <p>Dear Customer,</p>
              <p>Thank you for choosing <strong>SHOPFLOW</strong>! Your order <strong>#${
                data.id
              }</strong> has been successfully placed. Here are the details:</p>
              <div class="order-details">
                <p><strong>Items Ordered:</strong></p>
                <ul>
                  ${data.items
                    .map(
                      (item) =>
                        `<li>Product ID: ${item.productId}, Quantity: ${item.quantity}, Price: $${item.price}</li>`
                    )
                    .join("")}
                </ul>
                <p><strong>Total Amount:</strong> $${data.totalAmount}</p>
                <p><strong>Order Date:</strong> ${new Date(
                  data.orderDate
                ).toLocaleString()}</p>
                <p><strong>Expected Delivery Date:</strong> ${deliveryDate.toLocaleString()}</p>
                <p><strong>Payment Status:</strong> ${data.paymentStatus}</p>
              </div>
              <p>We will keep you updated on the status of your order. If you have any questions, feel free to reach out to our customer support team.</p>
            </div>
            <div class="footer">
              Thank you for shopping with ShopFlow! 
            </div>
          </div>
        </body>
        </html>
      `,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error("Failed to send email");
  }
};

module.exports = {
  sendPasswordResetEmail,
  orderUpdateEmail,
};
