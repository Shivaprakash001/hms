import { authService } from './lib/services/auth-service';
import { prisma } from './lib/db';

async function test() {
  const testEmail = `test_owner_${Math.floor(Math.random() * 100000)}@trishul.solutions`;
  const testPassword = 'Password123!';

  console.log(`Attempting to register: ${testEmail}`);

  try {
    const profile = await authService.registerOwner({
      email:    testEmail,
      password: testPassword,
      name:     'Test Owner',
      phone:    '1234567890',
      // Hostel details are now captured in /onboarding/hostel (step 2)
    });

    console.log('Registration SUCCESS!');
    console.log('Profile:', profile);
  } catch (error: any) {
    console.error('Registration FAILED:', error.message);
  }
}

test()
  .catch(e => console.error('Unexpected error:', e))
  .finally(async () => {
    await prisma.$disconnect();
  });
