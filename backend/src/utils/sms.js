async function sendOTP(phone, otp) {
  const key = process.env.FAST2SMS_KEY
  if (!key) {
    console.log(`SMS OTP for ${phone}: ${otp}`)
    return
  }
  try {
    const message = `Your TN15 OTP is ${otp}. Valid for 5 minutes. Do not share with anyone.`
    const url = `https://www.fast2sms.com/dev/bulkV2?authorization=${key}&route=q&message=${encodeURIComponent(message)}&language=english&flash=0&numbers=${phone}`
    const res = await fetch(url)
    const data = await res.json()
    console.log('SMS sent:', data)
    return data
  } catch (e) {
    console.error('SMS error:', e)
  }
}

module.exports = { sendOTP }