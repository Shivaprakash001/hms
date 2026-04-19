const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.log('Missing Supabase credentials in .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  const email = `test_auth_${Math.floor(Math.random() * 10000)}@example.com`
  const password = 'Password123!'
  
  console.log(`Testing auth creation for: ${email}`)
  
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  })
  
  if (error) {
    console.error('Supabase Auth Error:', error.message)
  } else {
    console.log('Supabase Auth Success! User ID:', data.user.id)
    
    // Clean up
    const { error: deleteError } = await supabase.auth.admin.deleteUser(data.user.id)
    if (deleteError) console.error('Cleanup failed:', deleteError.message)
    else console.log('Cleanup successful.')
  }
}

test()
