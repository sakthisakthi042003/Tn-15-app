async function sendOTP(phone, otp) {
  const key = process.env.FAST2SMS_KEY
  if (!key) { console.log(`SMS OTP for ${phone}: ${otp}`); return }
  
  try {
    const res = await fetch(`https://www.fast2sms.com/dev/bulkV2?authorization=${key}&route=otp&variables_values=${otp}&flash=0&numbers=${phone}`)
    const data = await res.json()
    console.log('SMS sent:', data)
    return data
  } catch (e) {
    console.error('SMS error:', e)
  }
}

module.exports = { sendOTP }