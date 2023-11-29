const nodemailer = require("nodemailer");
const { generateOtp } = require("./generate_otp");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: true,
  auth: {
    user: process.env.SMTP_MAIL,
    pass: process.env.SMTP_PASSWORD,
  },
});

const sendEmail = (email) => {
    
    const otp = generateOtp();
    var mailOptions = {
        from: process.env.SMTP_MAIL,
        to: email,
        subject: "OTP from CCExtractor Beacon",
        html: `<p>Dear User, Your OTP for reseting password from CCExtractor BEACON is :</p> <b>${otp}</b>`
    }

    transporter.sendMail(mailOptions, (error, info) => {
        if(error){
            console.log("Error -", error);
            return false;
        }else{
            console.log("Email send Successfully");
            return true;
        }
    })
    return otp;
}

module.exports = {sendEmail};