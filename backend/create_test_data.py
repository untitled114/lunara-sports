#!/usr/bin/env python
import os
import sys
import django
from decimal import Decimal

# Setup Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Lunara.settings.development')
django.setup()

from apps.accounts.models import User
from apps.projects.models import Project
from datetime import datetime, timedelta

def create_test_data():
    print("Creating test data...")

    # Get or create user
    try:
        user = User.objects.get(email='testuser@example.com')
        print(f'✅ Found existing user: {user.email}')
    except User.DoesNotExist:
        user = User.objects.create_user(
            username='testuser',
            email='testuser@example.com',
            password='testpass123',
            user_type='freelancer'
        )
        print(f'✅ Created new user: {user.email}')

    # Create projects with all required fields including deadline
    projects_data = [
        {'title': 'Mobile App UI Design', 'status': 'active', 'total_amount': Decimal('2500.00'), 'deadline': datetime.now() + timedelta(days=30)},
        {'title': 'E-commerce Website Development', 'status': 'active', 'total_amount': Decimal('5000.00'), 'deadline': datetime.now() + timedelta(days=45)},
        {'title': 'API Integration Project', 'status': 'completed', 'total_amount': Decimal('1500.00'), 'deadline': datetime.now() + timedelta(days=15)}
    ]

    for data in projects_data:
        project, created = Project.objects.get_or_create(
            title=data['title'],
            defaults={
                'description': f'Sample project: {data["title"]}',
                'total_amount': data['total_amount'],
                'status': data['status'],
                'deadline': data['deadline'],
                'client': user,
                'freelancer': user
            }
        )
        if created:
            print(f'✅ Created project: {project.title} - ${project.total_amount}')
        else:
            print(f'✅ Found existing project: {project.title}')

    print('\n🎉 Test data setup complete!')
    print('\n=== LOGIN CREDENTIALS ===')
    print('Email: testuser@example.com')
    print('Password: testpass123')

if __name__ == '__main__':
    create_test_data()