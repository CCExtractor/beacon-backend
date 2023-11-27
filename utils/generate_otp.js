const otpGenerator = require('otp-generator')

const generateOtp = () => {
    return otpGenerator.generate(6, { upperCaseAlphabets: false, lowerCaseAlphabets: false, specialChars: false });
}

module.exports = {generateOtp};