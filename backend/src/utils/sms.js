async function sendOTP(phone, otp) {
  const key = process.env.TWOFACTOR_KEY
  if (!key) {
    console.log(`SMS OTP for ${phone}: ${otp}`)
    return
  }
  try {
    const url = `https://2factor.in/API/V1/${key}/SMS/${phone}/${otp}/OTP1`
    const res = await fetch(url)
    const data = await res.json()
    console.log('SMS sent:', data)
    return data
  } catch (e) {
    console.error('SMS error:', e)
  }
}

module.exports = { sendOTP }