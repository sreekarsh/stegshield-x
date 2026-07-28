const nodemailer = require("nodemailer");
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com", port: 587, secure: false,
  auth: { user: "sreekarsh44@gmail.com", pass: "ygowiymwklkysgak" },
});
transporter.sendMail({
  from: "StegShield X <sreekarsh44@gmail.com>",
  to: "sreekarsh44@gmail.com",
  subject: "SMTP Test - StegShield X",
  text: "SMTP is configured and working correctly.",
}).then(info => { console.log("EMAIL SENT:", info.messageId); process.exit(0); })
  .catch(e => { console.error("FAILED:", e.message); process.exit(1); });
