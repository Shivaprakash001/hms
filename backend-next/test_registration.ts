import { authService } from './lib/services/auth-service';
import { prisma } from './lib/db';

async function test() {
  const testEmail = `test_owner_${Math.floor(Math.random() * 100000)}@trishul.solutions`;
  const testPassword = 'Password123!';
  
  console.log(`Attempting to register: ${testEmail}`);
  
  try {
    const profile = await authService.registerOwner({
      email: testEmail,
      password: testPassword,
      name: 'Test Owner',
      phone: '1234567890',
      hostel_name: 'Test Hostel',
      hostel_phone: '0987654321',
      hostel_address: '123 Test St',
      hostel_city: 'Bangalore',
      hostel_state: 'Karnataka',
      hostel_pincode: '560001',
    });

    console.log('Registration SUCCESS!');
    console.log('Profile:', profile);
    
    // Clean up if desired, or leave for manual verification in Supabase dashboard
    // await prisma.profile.delete({ where: { id: profile.id } });
  } catch (error: any) {
    console.error('Registration FAILED:', error.message);
  }
}

test()
  .catch(e => console.error('Unexpected error:', e))
  .finally(async () => {
    await prisma.$disconnect();
  });
