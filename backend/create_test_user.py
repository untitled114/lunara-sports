"""
Script to create a test user for Lunara platform.
Run this from the backend directory: python create_test_user.py
"""

import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Lunara.settings')
django.setup()

from apps.accounts.models import User

# Test user credentials
TEST_EMAIL = 'eltrozo@lunara.com'
TEST_PASSWORD = 'test123456'
TEST_USERNAME = 'eltrozo'

def create_test_user():
    """Create or update test user."""
    try:
        # Check if user already exists
        user = User.objects.filter(email=TEST_EMAIL).first()

        if user:
            print(f'✅ User {TEST_EMAIL} already exists!')
            print(f'   Updating password...')
            user.set_password(TEST_PASSWORD)
            user.is_verified = True
            user.save()
            print(f'✅ Password updated successfully!')
        else:
            print(f'Creating new user: {TEST_EMAIL}')
            user = User.objects.create_user(
                username=TEST_USERNAME,
                email=TEST_EMAIL,
                password=TEST_PASSWORD,
                user_type='freelancer',
                is_verified=True,
                first_name='Test',
                last_name='User'
            )
            print(f'✅ User created successfully!')

        print(f'\n📧 Email: {TEST_EMAIL}')
        print(f'🔑 Password: {TEST_PASSWORD}')
        print(f'👤 Username: {TEST_USERNAME}')
        print(f'\nYou can now log in with these credentials.')

    except Exception as e:
        print(f'❌ Error creating user: {e}')
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    create_test_user()
